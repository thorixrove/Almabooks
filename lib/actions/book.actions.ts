"use server"

import { CreateBook, TextSegment } from "@/types"
import { connectToDatabase } from "@/database/mongoose"
import { escapeRegex, generateSlug, serializeData } from "../utils"
import Book from "@/database/models/book.model"
import BookSegment from "@/database/models/book-segment.model"
import mongoose from "mongoose"



export const getAllBooks = async (search?: string) => {
    try {
        await connectToDatabase()

        let query = {}

        if (search) {
            const escapedSearch = escapeRegex(search)
            const regex = new RegExp(escapedSearch, "i")
            query = {
                $or: [
                    { title: { $regex: regex}},
                    { author: { $regex: regex}},
                ]
            }
        }

        const books = await Book.find(query).sort({ createdAt: -1}).lean()

        return {
            success: true,
            data: serializeData(books)
        }
    } catch (error) {
        console.error("Error pada koneksi database", error)
        return{
            success: false, error: error
        }
    }
}


export const checkBookExists = async (title: string) => {
    try {
        await connectToDatabase();

        const slug = generateSlug(title);

        const existingBook = await Book.findOne({slug}).lean();

        if(existingBook) {
            return {
                exists: true,
                book: serializeData(existingBook)
            }
        }

        return {
            exists: false,
        }
    } catch (error) {
        console.error('Error ketika mencari keberadaan buku', error);
        return {
            exists: false, error: error
        }
    }
}


export const createBook = async (data: CreateBook) => {
    try {
        await connectToDatabase()

        const slug = generateSlug(data.title)

        const existingBook = await Book.findOne({slug}).lean()

        if(existingBook){
            return {
                success: true,
                data: serializeData(existingBook),
                alreadyExists: true,
            }
        }

        //catatan: memerikas limit subscription sebelum meembuat buku
        const { getUserPlan } = await import("@/lib/subscription.server")
        const { PLAN_LIMITS} = await import("@/lib/subscription-constants")

        const { auth } = await import("@clerk/nextjs/server")
        const { userId} = await auth()

        if(!userId || userId !== data.clerkId) {
            return { success: false, error: "Unauthorized"}
        }

        const plan = await getUserPlan()
        const limits = PLAN_LIMITS[plan]

        const bookCount = await Book.countDocuments({ clerkId: userId})

        if (bookCount >= limits.maxBooks) {
            const { revalidatePath } = await import('next/cache')
            revalidatePath("/")

            return {
                success: false,
                error: `Kamu sudah mencapai batas maximum buku yang diperbolehkan untukmu ${plan} plan (${limits.maxBooks}). Mohon Upgrade untuk memasukkan lebih banyak buku.`,
                isBillingError: true,
            }
        }

        const book = await Book.create({...data, clerkId: userId, slug, totalSegments: 0})

        return {
            success: true,
            data: serializeData(book),
        }
    } catch (error) {
        console.error("Gagal membuat buku", error)

        return{
            success: false,
            error: error,
        }
    }
}

export const getBookBySlug = async (slug: string) => {
    try {
        await connectToDatabase();

        const book = await Book.findOne({ slug }).lean();

        if (!book) {
            return { success: false, error: 'Buku tidak ditemukkan' };
        }

        return {
            success: true,
            data: serializeData(book)
        }
    } catch (error) {
        console.error('Error mengambil buku dari slug', error);
        return {
            success: false, error: error
        }
    }
}



export const saveBookSegments = async (bookId: string, clerkId: string, segment: TextSegment[]) => {
    try {
        await connectToDatabase()

        console.log("Menyimpan segmentasi buku...")

        const segmentsToInsert = segment.map(({ text, segmentIndex, pageNumber, wordCount }) => ({
            clerkId, bookId, content: text, segmentIndex, pageNumber, wordCount
        }))

        await BookSegment.insertMany(segmentsToInsert)

        await Book.findByIdAndUpdate(bookId, { totalSegments: segment.length})

        console.log("Segmentasi buku berhasil disimpan.")

        return{
            success: true,
            data: { segmentsCreated: segment.length}
        }
    } catch (error) {
        console.error("Gagal menyimpan segmentasi buku", error)

        return{
            success: false,
            error: error,
        }
    }
}


// Mencari segmentasi buku menggunnakan MongoDB pencarian text regex fallback
export const searchBookSegments = async (bookId: string, query: string, limit: number = 5) => {
    try {
        await connectToDatabase()

        console.log(`Mencari untuk: "${query}" di dalam buku ${bookId}`)

        const bookObjectId = new mongoose.Types.ObjectId(bookId)

        // Mencoba text MongoDB pencarian pertama (membutuhkan index text)
        let segment: Record<string, unknown>[] = []
        
        try {
            segment = await BookSegment.find({
                bookId: bookObjectId,
                $text: {$search: query},
            })

            .select("_id bookId content segmentIndex pageNumber wordCount")
            .sort({ score: { $meta: 'textScore' } })
            .limit(limit)
            .lean()
        } catch {
            // Index text mungkin tidak exist - fall through to regex fallback
            segment = []
        }

        // Fallback: regex sedang mencari keyword yang sesuai
        if (segment.length === 0) {
            const keyword = query.split(/\s+/).filter((k) => k.length > 2)
            const pattern = keyword.map(escapeRegex).join("|")

            segment = await BookSegment.find({
                bookId: bookObjectId,
                content: { $regex: pattern, $options: "i"},
            })
            .select("_id bookId content segmentIndex pageNumber wordCount")
            .sort({ segmentIndex: 1})
            .limit(limit)
            .lean()
        }

        console.log(`Pencarian Berhasil. Ditemukan ${segment.length} results`)

        return {
            success: true,
            data: serializeData(segment),
        }
    } catch (error) {
        console.error("Mencari segmentasi error", error)
        return {
            success: false,
            error: (error as Error).message,
            data: [],
        }
    }
}
