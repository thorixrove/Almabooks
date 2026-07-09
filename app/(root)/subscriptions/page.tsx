import { PricingTable } from "@clerk/nextjs";

export default function SubscriptionsPage() {
    return(
        <div className="container wrapper py-10">
            <div className="flex flex-col items-center text-center mb-10">
                <h1 className="text-4xl font-bold font-serif mb-4">Pilih Rencanamu</h1>
                <p className="text-muted-foreground max-w-2xl">
                    Upgrade untuk membuka lebih banyak buku, sesi yang lebih lama, dan fitur-fitur lanjutan.
                </p>
            </div>

            <div className="clerk-pricing-container">
                <PricingTable/>
            </div>
        </div>
    )
}