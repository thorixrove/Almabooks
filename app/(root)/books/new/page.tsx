import UploadForm from '@/components/UploadForm'
import React from 'react'

const page = () => {
  return (
    <main className='new-book'>
        <section className='flex flex-col gap-5 text-center'>
            <h1 className='page-title-xl'>Masukkan file buku</h1>
            <p className='subtitle'>Masukkan PDF nya untuk menghasilkan pengalaman membaca yang interaktiv</p>
        </section>
        <UploadForm/>
    </main>
  )
}

export default page
