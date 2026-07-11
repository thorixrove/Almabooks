'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import { deleteBook } from '@/lib/actions/book.actions'
import { toast } from 'sonner'
import { createPortal } from 'react-dom'

interface BookCardProps {
    _id: string
    title: string
    author: string
    coverURL: string
    slug: string
    onDeleted?: (id: string) => void
}

const BookCard = ({ _id, title, author, coverURL, slug, onDeleted}: BookCardProps) => {
    const [showConfirm, setShowConfirm] = useState(false)
    const [isPending, startTransition] = useTransition()

    const handleDelete = () => {
        startTransition(async () => {
            const result = await deleteBook(_id)

            if (result.success) {
                toast.success(`"${title}" berhasil dihapus`)
                setShowConfirm(false)
                onDeleted?.(_id)
            }else{
                toast.error(result.error || "Gagal menghapus buku")
            }
        })
    }



    return (
        <div className="book-card group relative">
            <button
                onClick={(e) => {
                    e.preventDefault()
                    setShowConfirm(true)
                }}
                className="absolute top-2 right-2 z-10 rounded-full bg-white/90 p-2 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 hover:bg-red-50"
                aria-label={`Hapus buku ${title}`}
            >
                <Trash2 className="size-4 text-red-600" />
            </button>

            <Link href={`/books/${slug}`}>
                <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-gray-100">
                    <Image
                        src={coverURL}
                        alt={title}
                        fill
                        sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 20vw"
                        className="object-cover"
                    />
                </div>
                <h3 className="mt-2 font-serif font-bold text-[#212a3b]">{title}</h3>
                <p className="text-sm text-[#212a3b]/70">{author}</p>
            </Link>

            {showConfirm &&
                typeof document !== 'undefined' &&
                createPortal(
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
                        onClick={() => !isPending && setShowConfirm(false)}
                    >
                        <div
                            className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h4 className="font-serif text-lg font-bold text-[#212a3b]">
                                Hapus buku ini?
                            </h4>
                            <p className="mt-2 text-sm text-[#212a3b]/70">
                                &quot;{title}&quot; akan dihapus permanen, termasuk semua riwayat sesi diskusi. Tindakan ini tidak bisa dibatalkan.
                            </p>
                            <div className="mt-5 flex justify-end gap-3">
                                <button
                                    onClick={() => setShowConfirm(false)}
                                    disabled={isPending}
                                    className="rounded-full border border-black/10 px-4 py-2 text-sm font-medium text-black transition hover:bg-black hover:text-white disabled:opacity-50"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={handleDelete}
                                    disabled={isPending}
                                    className="rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
                                >
                                    {isPending ? 'Menghapus...' : 'Ya, Hapus'}
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
        </div>
    )
}

export default BookCard