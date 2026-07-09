"use client"

import { useEffect, useState } from "react"
import { Input } from "./ui/input"
import { Search as SearchIcon } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

const Search = () => {
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()

    const [query, setQuery] = useState(searchParams.get("query") || "")

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            const params = new URLSearchParams(window.location.search)

            if(query) {
                params.set("query", query)
            }else{
                params.delete("query")
            }

            router.push(`${pathname}?${params.toString()}`, {scroll: false})
        }, 300)

        return () => clearTimeout(delayDebounceFn)
    }, [query, pathname, router])

    return (
        <div className="library-search-wrapper">
            <div className="pl-4">
                <SearchIcon
                size={20}
                className="text-[var(--text-mmuted)]"/>
            </div>
            <Input
            type="text"
            placeholder="Mencari buku bedasarkan Judul atau Author"
            className="library-search-input border-none shadow-none focus-visible:right-0"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            />
        </div>
    )
}

export default  Search