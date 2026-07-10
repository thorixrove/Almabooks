"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Vapi from "@vapi-ai/web"
import { useAuth } from "@clerk/nextjs"

import { useSubscription } from "./useSubscription"
import { ASSISTANT_ID, DEFAULT_VOICE, VOICE_SETTINGS } from "@/lib/constants"
import { getVoice } from "@/lib/utils"
import { IBook, Messages } from "@/types"
import { startVoiceSession, endVoiceSession } from "@/lib/actions/session.actions"


export function useLatestRef<T>(value: T) {
    const ref = useRef(value)

    useEffect(() => {
        ref.current = value
    }, [value])

    return ref
}

const VAPI_API_KEY = process.env.NEXT_PUBLIC_VAPI_API_KEY
const TIMER_INTERVAL_MS = 1000
const SECONDS_PER_MINUTE = 60
const TIME_WARNING_THRESHOLD = 60 //Tunjukkan peringatan ketika waktu hanya tersisa sekian detik

let vapi: InstanceType<typeof Vapi>
function getVapi() {
    if (!vapi) {
        if(!VAPI_API_KEY) {
            throw new Error("NEXT_PUBLIC_VAPI_API_KEY environtment belum di set")
        }
        vapi = new Vapi(VAPI_API_KEY)
    }
    return vapi
}

export type CallStatus = "idle" | "connecting" | "starting" | "listening" | "thinking" | "speaking"

export function useVapi(book: IBook) {
    const { userId } = useAuth()
    const {limits} = useSubscription()

    const [status, setStatus] = useState<CallStatus>("idle")
    const [messages, setMessages] = useState<Messages[]>([])
    const[currentMessage, setCurrentMessage] = useState("")
    const[currentUserMessage, setCurrentUserMessage] = useState("")
    const [duration, setDuration] = useState(0)
    const [limitError, setLimitError] = useState<string | null>(null)
    const [isBillingError, setIsBillingError] = useState(false)

    const timerRef = useRef<NodeJS.Timeout | null>(null)
    const startTimeRef = useRef<number | null>(null)
    const sessionIdRef = useRef<string | null>(null)
    const isStoppingRef = useRef(false)

    // Biarkan refs di sync dengan nilai terbaru untuk digunkan dalam callbacks
    const maxDurationSeconds = limits?.maxDurationPerSession ? limits.maxDurationPerSession * 60 : (15 * 60 )
    const maxDurationRef = useLatestRef(maxDurationSeconds)
    const durationRef = useLatestRef(duration)
    const voice = book.persona || DEFAULT_VOICE

    // Set up Vapi untuk bagian mendengar
    useEffect(() => {
        const handlers = {
            "call-start": () => {
                isStoppingRef.current = false
                setStatus("starting")
                setCurrentMessage("")
                setCurrentUserMessage("")

                // Mulai waktu durasi
                startTimeRef.current = Date.now()
                setDuration(0)
                timerRef.current = setInterval(() => {
                    if (startTimeRef.current) {
                        const newDuration = Math.floor((Date.now() - startTimeRef.current) / TIMER_INTERVAL_MS)
                        setDuration(newDuration)

                        // Check limit durasi
                        if (newDuration >= maxDurationRef.current) {
                            getVapi().stop()
                            setLimitError(
                                `Sesi limit waktu (${Math.floor(
                                    maxDurationRef.current / SECONDS_PER_MINUTE,
                                )} menit) dicapai. Upgrade rencanamu untuk sesi yang lebih panjang.`,
                            )
                        }
                    }
                }, TIMER_INTERVAL_MS)
            },

            "call-end": () => {
                // Jangan mereset isStoppingRef disini - event delay masih bekerja
                setStatus("idle")
                setCurrentMessage("")
                setCurrentUserMessage("")

                // Waktunya stop
                if (timerRef.current) {
                    clearInterval(timerRef.current)
                    timerRef.current = null
                }

                // Sesi trackinng dihentikan
                if (sessionIdRef.current) {
                    endVoiceSession(sessionIdRef.current, durationRef.current).catch((err) =>
                    console.error("Sesi voice gagal berhenti:", err),
                )
                sessionIdRef.current = null
                }

                startTimeRef.current = null
            },
            
            "speech-start": ()=> {
                if (!isStoppingRef.current) {
                    setStatus("speaking")
                }
            },

            "speech-end": () => {
                if(!isStoppingRef.current) {
                    // Setelah AI selesai berbicara, user bisa berbicara
                    setStatus("listening")
                }
            },

            message: (message: {
                type: string
                role: string
                transcriptType: string
                transcript: string
            }) => {
                if (message.type !== "transcript") return

                //Setelah user berbicara -> Ai mulai berfikir
                if(message.role === "user" && message.transcriptType == "final") {
                    if(!isStoppingRef.current) {
                        setStatus("thinking")
                    }
                    setCurrentMessage("")
                }

                // Partial user transcript -> tunjukan sedang mengetik secara langsung
                if (message.role === "user" && message.transcriptType === "partial") {
                    setCurrentMessage(message.transcript)
                    return
                }

                // Partial AI transcript -> tunjukan kata demi kata 
                if (message.role == "assistant" && message.transcriptType === "partial") {
                    setCurrentMessage(message.transcript)
                    return
                }

                // Final transcript -> masukan ke pesan
                if (message.transcriptType === "final") {
                    if (message.role === "assistent") setCurrentMessage("")
                    if (message.role === "user") setCurrentUserMessage("")

                        setMessages((prev) => {
                            const isDupe = prev.some(
                                (m) => m.role === message.role && m.content === message.transcript,
                            )
                            return isDupe ? prev : [...prev, {role: message.role, content: message.transcript}]
                        })
                }
            },

            error: (error: Error) => {
                console.error("Vapi error:", error)
                // jangan mereset isStopingRef disini - event delay masih bekerja
                setStatus("idle")
                setCurrentMessage("")
                setCurrentUserMessage("")

                // Hentikan timer ketika error
                if (timerRef.current) {
                    clearInterval(timerRef.current)
                    timerRef.current = null
                }

                // Hentikan sesi ketika tracking error
                if (sessionIdRef.current) {
                    endVoiceSession(sessionIdRef.current, durationRef.current).catch((err) =>
                    console.error("Sesi voice gagal berhenti karena error:", err),
                )
                sessionIdRef.current = null
                }

                // Tujukkan pesan error ke user-friendly
                const errorMessage = error.message?.toLowerCase() || ""
                if (errorMessage.includes("timeout") || errorMessage.includes("silence")) {
                    setLimitError("Sesi berakhir karna tidak ada aktivitas. Click mic untuk memulai lagi.")
                } else if (errorMessage.includes("network") || errorMessage.includes("connection")) {
                    setLimitError("Koneksi hilang. Mohon periksa kembali koneksi internetmu dan coba lagi")
                } else {
                    setLimitError("Sesi berakhir secara tiba-tiba. Click mic untuk memulai lagi.")
                }

                startTimeRef.current = null
            },
        }

        // memegang semua register
        Object.entries(handlers).forEach(([event, handler]) => {
            getVapi().on(event as keyof typeof handlers, handler as () => void)
        })

        return () => {
            // Mengakhiri suatu sesi program
            if (sessionIdRef.current) {
                getVapi().stop()
                endVoiceSession(sessionIdRef.current, durationRef.current).catch((err) =>
                console.error("Gagal untuk mengakhiri sesi voice pada program:", err),
            )
            sessionIdRef.current = null
            }
            // Membersihkan handlres
            Object.entries(handlers).forEach(([event, handler]) => {
                getVapi().off(event as  keyof typeof handlers, handler as () => void)
            })

            if(timerRef.current) clearInterval(timerRef.current)
        }
    }, [])



    const start = useCallback(async () => {
        if (!userId) {
            setLimitError('Mohon sign in untuk memulai sesi voice.');
            return;
        }

        setLimitError(null);
        setIsBillingError(false);
        setStatus('connecting');

        try {
            // check sesi limit dan buat sesi record
            const result = await startVoiceSession(userId, book._id);

            if (!result.success) {
                setLimitError(result.error || 'Sesi limit telah mencapai batas. Mohon upgrade rencanamu');
                setIsBillingError(!!result.isBillingError);
                setStatus('idle');
                return;
            }

            sessionIdRef.current = result.sessionId || null;
            // Catatan: Nilai maxDurationMinutes yang dikembalikan oleh server hanya bersifat informatif
            // Batasan (limit) yang sebenarnya dipaksakan oleh fungsi useLatestRef(limits.maxSessionMinutes * 60)

            const firstMessage = `Hey, senang bertemu dengan mu. Pertanyaan singkat sebelum kita menyelam lebih dalam - apakah kau sudah membaca ${book.title} belum, ataukah kita mulai dari awal?`;

            await getVapi().start(ASSISTANT_ID, {
                firstMessage,
                variableValues: {
                    title: book.title,
                    author: book.author,
                    bookId: book._id,
                },
                voice: {
                    provider: '11labs' as const,
                    voiceId: getVoice(voice).id,
                    model: 'eleven_turbo_v2_5' as const,
                    stability: VOICE_SETTINGS.stability,
                    similarityBoost: VOICE_SETTINGS.similarityBoost,
                    style: VOICE_SETTINGS.style,
                    useSpeakerBoost: VOICE_SETTINGS.useSpeakerBoost,
                },
            });
        } catch (err) {
            console.error('Gagal untuk memulai panggilan:', err);
            setStatus('idle');
            setLimitError('Gagal untuk memulai sesi voice. Mohon coba lagi');
        }
    }, [book._id, book.title, book.author, voice, userId]);

    const stop = useCallback(() => {
        isStoppingRef.current = true;
        getVapi().stop();
    }, []);

    const clearError = useCallback(() => {
        setLimitError(null);
        setIsBillingError(false);
    }, []);

    const isActive =
        status === 'starting' ||
        status === 'listening' ||
        status === 'thinking' ||
        status === 'speaking';

    // Calculate remaining time
    // const maxDurationSeconds = limits.maxSessionMinutes * SECONDS_PER_MINUTE;
    // const remainingSeconds = Math.max(0, maxDurationSeconds - duration);
    // const showTimeWarning =
    //     isActive && remainingSeconds <= TIME_WARNING_THRESHOLD && remainingSeconds > 0;

    return {
        status,
        isActive,
        messages,
        currentMessage,
        currentUserMessage,
        duration,
        start,
        stop,
        limitError,
        isBillingError,
        maxDurationSeconds,
        clearError,
        // maxDurationSeconds,
        // remainingSeconds,
        // showTimeWarning,
    };


}

export default useVapi