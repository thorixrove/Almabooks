import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI

if(!MONGODB_URI) throw new Error ("Mohon memanggil variabel environtmen MONGODB_URI")

declare global {
    var mongooseCache: {
        conn: typeof mongoose | null
        promise: Promise<typeof mongoose> | null
    }
}

let cached = global.mongooseCache || (global.mongooseCache = { conn: null, promise: null})

export const connectToDatabase = async () => {
    if(cached.conn) return cached.conn

    if(!cached.promise) {
        cached.promise = mongoose.connect(MONGODB_URI, { bufferCommands: false})
    }

    try {
        cached.conn = await cached.promise
    } catch (error) {
        cached.promise = null
        console.error("Koneksi Mongodb ERROR. Mohon pastikan MongoDB berjalan." + error)
        throw error

    }

    console.info("Terkoneksi ke MongoDB")
    return cached.conn
}
