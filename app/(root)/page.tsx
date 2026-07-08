import React from 'react'
import HeroSection from "@/components/HeroSection"
import { sampleBooks } from '@/lib/constants'
import BookCard from '@/components/BookCard'


const page = () => {
  return (
    <div className="wrapper container">
        <HeroSection />
        <div className='library-books-grid'>
          {sampleBooks.map((book) => (
            <BookCard key={book._id} title={book.title} author={book.author} coverURL={book.coverURL}
            slug={book.slug}/>
          ))}
        </div>
    </div>
  )
}

export default page
