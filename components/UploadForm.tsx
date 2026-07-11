'use client';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { checkBookExists, createBook, saveBookSegments } from '@/lib/actions/book.actions';
import { ACCEPTED_IMAGE_TYPES, ACCEPTED_PDF_INPUT_TYPES } from '@/lib/constants';
import { parsePDFFile } from '@/lib/utils';
import { UploadSchema } from '@/lib/zod';
import { BookUploadFormValues } from '@/types';
import { useAuth } from '@clerk/nextjs';
import { zodResolver } from '@hookform/resolvers/zod';
import { upload } from "@vercel/blob/client";
import { ImageIcon, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from "sonner";
import FileUploader from './FileUploader';
import LoadingOverlay from './LoadingOverlay';
import VoiceSelector from './VoiceSelector';

const UploadForm = () => {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isMounted, setIsMounted]= useState(false)
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

            toast.error("Gagal mengupload buku. Mohon coba lagi.")
        } finally {
            setIsSubmitting(false)
        }
    }

    if(!isMounted) return null


    return (
        <>
            {isSubmitting && <LoadingOverlay />}

            <div className="new-book-wrapper">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                        {/* 1. PDF File Upload */}
                        <FileUploader
                            control={form.control}
                            name="pdfFile"
                            label="File PDF Buku"
                            acceptTypes={ACCEPTED_PDF_INPUT_TYPES}
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