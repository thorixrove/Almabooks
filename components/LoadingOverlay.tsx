"use client"

import { Loader2 } from "lucide-react"

const LoadingOverlay = () => {
    return(
        <div className="loading-wrapper">
            <div className="loading-shadow-wrapper bg-white shadow-soft-lg">
                <div className="loading-shadow">
                    <Loader2 className="loading-animation w-12 h-12 text-[#663820]" />
                    <h2 className="loading-title">Synthesizing bukumu</h2>
                    <p className="text-[#777] text-center max-w-xs">
                        Mohon ditunggu kami sedang memproses PDF dan menyiapkan pengalaman interaktiv membacamu
                    </p>
                </div>
            </div>
        </div>
    )
}

export default LoadingOverlay