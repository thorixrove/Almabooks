'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Upload, ImageIcon } from 'lucide-react';
import { UploadSchema } from '@/lib/zod';
import { BookUploadFormValues } from '@/types';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ACCEPTED_PDF_TYPES, ACCEPTED_IMAGE_TYPES, } from '@/lib/constants';
import FileUploader from './FileUploader';
import VoiceSelector from './VoiceSelector';
import LoadingOverlay from './LoadingOverlay';
import { useAuth } from '@clerk/nextjs';
import { toast } from "sonner"
import { checkBookExists, createBook, saveBookSegments } from '@/lib/actions/book.actions';
import { useRouter } from 'next/navigation';
import { parsePDFFile } from '@/lib/utils';
import {upload} from "@vercel/blob/client"

const UploadForm = () => {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isMounted, setIsMounted]= useState(false)
    const [debugError, setDebugError] = useState<string | null>(null)
    const {userId} = useAuth()
    const router = useRouter()

    useEffect(() => {
        setIsMounted(true)
    }, [])

    const form = useForm<BookUploadFormValues>({
        resolver: zodResolver(UploadSchema),
        defaultValues: {
            title: "",
            author: "",
            persona: "",
            pdfFile: undefined,
            coverImage: undefined,
        }
    })

    const onSubmit = async (data: BookUploadFormValues) => {
        if(!userId) {
            return toast.error("Mohon login untuk upload buku")
        }

        setIsSubmitting(true)
        setDebugError(null)

        // PostHog -> melacak penguploadan buku

        try {
            const existsCheck = await checkBookExists(data.title)

            if(existsCheck.exists && existsCheck.book) {
                toast.info("Buku dengan judul yang sama exist.")
                form.reset()
                router.push(`/books/${existsCheck.book.slug}`)
                return
            }

            const fileTitle = data.title.replace(/\s+/g, '-').toLowerCase()
            const pdfFile = data.pdfFile

            const parsePDF = await parsePDFFile(pdfFile)

            if(parsePDF.content.length === 0) {
                toast.error("Gagal menguraikan file PDF. Mohon menggunakan file yang sama.")
                return
            }

            const uploadedPdfBlob = await upload(fileTitle, pdfFile, {
                access: "public",
                handleUploadUrl: "/api/upload",
                contentType: "application/pdf"
            })

            let coverUrl: string

            if(data.coverImage) {
                const coverFile = data.coverImage
                const uploadCoverBlob = await upload(`${fileTitle}_cover.png`, coverFile, {
                    access: "public",
                    handleUploadUrl: "/api/upload",
                    contentType: coverFile.type
                })
                coverUrl = uploadCoverBlob.url

            } else {
                const response = await fetch(parsePDF.cover)
                const blob = await response.blob()

                const uploadCoverBlob = await upload(`${fileTitle}_cover.png`, blob, {
                    access: "public",
                    handleUploadUrl: "/api/upload",
                    contentType: "image/png"
                })

                coverUrl = uploadCoverBlob.url
            }

            const book = await createBook({
                clerkId: userId,
                title: data.title,
                author: data.author,
                persona: data.persona,
                fileURL: uploadedPdfBlob.url,
                fileBlobKey: uploadedPdfBlob.pathname,
                coverURL: coverUrl,
                fileSize: pdfFile.size
            })

            if(!book.success) {
                toast.error(book.error as string || "Gagal membuat buku")
                if (book.isBillingError) {
                    router.push("/subscriptions")
                }
                return
            }

            if(book.alreadyExists) {
                toast.info("Buku dengan judul yang sama exists.")
                form.reset()
                router.push(`/books/${book.data.slug}`)
                return
            }

            const segment = await saveBookSegments(book.data._id, userId, parsePDF.content)

            if(!segment.success) {
                toast.error("Gagal menyimpan segmentasi buku")
                throw new Error("Gagal menyimpan segmentasi buku")
            }

            form.reset()
            router.push("/")

        } catch (error) {
            console.error(error)

            // Tampilkan detail error di layar untuk debugging (khususnya di HP tanpa akses devtools)
            const fullMessage = error instanceof Error
                ? `${error.name}: ${error.message}\n\n${error.stack || ''}`
                : String(error)
            setDebugError(fullMessage)

            toast.error("Gagal mengupload buku. Mohon coba lagi.")
        } finally {
            setIsSubmitting(false)
        }
    }

    if(!isMounted) return null


    return (
        <>
            {isSubmitting && <LoadingOverlay />}

            {debugError && (
                <div className="mx-auto mb-4 max-w-2xl rounded-lg border border-red-300 bg-red-50 p-4">
                    <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm font-bold text-red-700">Debug Error (sementara)</p>
                        <button
                            onClick={() => setDebugError(null)}
                            className="text-xs text-red-500 underline"
                        >
                            Tutup
                        </button>
                    </div>
                    <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs text-red-800">
                        {debugError}
                    </pre>
                    <p className="mt-2 text-xs text-red-500">
                        Screenshot kotak ini dan kirim ke developer untuk membantu memperbaiki masalah.
                    </p>
                </div>
            )}

            <div className="new-book-wrapper">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                        {/* 1. PDF File Upload */}
                        <FileUploader
                            control={form.control}
                            name="pdfFile"
                            label="File PDF Buku"
                            acceptTypes={ACCEPTED_PDF_TYPES}
                            icon={Upload}
                            placeholder="Click to upload PDF"
                            hint="PDF file (max 50MB)"
                            disabled={isSubmitting}
                        />

                        {/* 2. Cover Image Upload */}
                        <FileUploader
                            control={form.control}
                            name="coverImage"
                            label="Cover Image (Optional)"
                            acceptTypes={ACCEPTED_IMAGE_TYPES}
                            icon={ImageIcon}
                            placeholder="Click to upload cover image"
                            hint="Biarkan kosong untuk dibuat secara otomatis dari PDF"
                            disabled={isSubmitting}
                        />

                        {/* 3. Title Input */}
                        <FormField
                            control={form.control}
                            name="title"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="form-label">Judul</FormLabel>
                                    <FormControl>
                                        <Input
                                            className="form-input"
                                            placeholder="ex: Rich Dad Poor Dad"
                                            {...field}
                                            disabled={isSubmitting}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* 4. Author Input */}
                        <FormField
                            control={form.control}
                            name="author"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="form-label">Nama Author</FormLabel>
                                    <FormControl>
                                        <Input
                                            className="form-input"
                                            placeholder="ex: Robert Kiyosaki"
                                            {...field}
                                            disabled={isSubmitting}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* 5. Voice Selector */}
                        <FormField
                            control={form.control}
                            name="persona"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="form-label">Pilih voice Assisten</FormLabel>
                                    <FormControl>
                                        <VoiceSelector
                                            value={field.value}
                                            onChange={field.onChange}
                                            disabled={isSubmitting}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* 6. Submit Button */}
                        <Button type="submit" className="form-btn" disabled={isSubmitting}>
                            Begin Synthesis
                        </Button>
                    </form>
                </Form>
            </div>
        </>
    );
};

export default UploadForm;