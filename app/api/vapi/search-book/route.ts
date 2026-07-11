import  { NextResponse} from "next/server"
import { searchBookSegments } from "@/lib/actions/book.actions"

// Membantu fungsi untuk memproses pencarian logika pada buku
async function processBookSearch(bookId: unknown, query: unknown) {
    //Validasi input sebelum coversesi untuk mencegah null/undefined menjadi "null"/"undefined" string
    if (bookId == null || query == null || query === "") {
        return {result: "Kehilangan bookId atau query"}
    }

    // Mengubah bookId menjadi string
    const booIdStr = String(bookId)
    const queryStr = String(query).trim()

    // Menambahkan validation setelah conversasi
    if(!booIdStr || booIdStr === "null" || booIdStr === "undefined" || !queryStr) {
        return {result: "Kehilangan bookId atau query"}
    }

    //Eksekusi(menghentikan) pencarian
    const searchresult = await searchBookSegments(booIdStr, queryStr, 3)
    
    // Kembali ke hasil
    if(!searchresult.success || !searchresult.data?.length) {
        return { result: "Tidak ditemukan informasi mengenai topic ini di dalam buku"}
    }

    const combinedText = searchresult.data
    .map((segment) => (segment as { content: string}).content)
    .join("\n\n")

    return { result: combinedText}
}

// Menguraikan alat argumentasi yang mungkin muncul sebagai JSON string atau object
function parseArgs(args: unknown): Record<string, unknown> {
    if(!args) return{}
    if (typeof args === "string") {
        try {return JSON.parse(args)} catch {return {}}
    }
    return args as Record<string, unknown>
}

export async function POST(request: Request) {
    try {
        const body = await request.json()

        console.log("Permintaa pencarian buku Vapi:", JSON.stringify(body, null, 2))

        // Support multiple Vapi Format
        const functionCall = body?.message?.functionCall
        const toolCallList = body?.message?.toolCallList || body?.message?.toolCalls

        // Menghandle format satuan functionCall
        if (functionCall) {
            const { name, parameters} = functionCall
            const parsed = parseArgs(parameters)

            if (name === "searchbook") {
                const result = await processBookSearch(parsed.bookId, parsed.query)
                return NextResponse.json(result)
            }

            return NextResponse.json({ result: `Unknown Function: ${name}`})
        }

        // Handle toolCallList format (array of calls)
        if (!toolCallList || toolCallList.length === 0) {
            return NextResponse.json({
                results: [{ result: "Tidak ada tool calls yang ditemukan"}]
            })
        }

        const results = []

        for (const toolCall of toolCallList) {
            const {id, function: func} = toolCall
            const name = func?.name
            const args = parseArgs(func?.arguments)

            if(name === "searchbook") {
                const searchResult = await processBookSearch(args.bookId, args.query)
                results.push({ toolCallId: id, ...searchResult})
            } else {
                results.push({ toolCallId: id, result: `Unknown function: ${name}`})
            }
        }

        return NextResponse.json({ results})
    } catch (error) {
        console.error("Vapi search-book error:", error)
        return NextResponse.json({
            results: [{ result: "Proses permintaan error"}],
        })
    }
}