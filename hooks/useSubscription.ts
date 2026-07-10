import { useAuth, useUser } from "@clerk/nextjs";
import { PLANS, PLAN_LIMITS, PlanType } from "@/lib/subscription-constants";

export const useSubscription = () => {
    const { has, isLoaded: isAuthLoaded} = useAuth()
    const {user, isLoaded: isUserLoaded} = useUser()


    const isLoaded = isAuthLoaded && isUserLoaded

    if (!isLoaded) {
        return {
            plan: PLANS.FREE,
            limits: PLAN_LIMITS[PLANS.FREE],
            isLoaded: false
        }
    }

    let plan: PlanType = PLANS.FREE

    // 1. Check Pertama: Clerk "has" membantu untuk useAuth
    if (has?.({ plan: "pro"})) {
        plan = PLANS.PRO
    } else if (has?.({ plan: "standard"})) {
        plan = PLANS.STANDARD
    }

    // 2. Check Kedua: Mundur kembali ke metadata public user jika 'has' gagal (caching isue)

    else {
        const metadataPlan = (user?.publicMetadata?.plan || user?.publicMetadata?.billingPlan)?.toString().toLowerCase()

        if (metadataPlan == "pro") {
            plan = PLANS.PRO
        } else if (metadataPlan === "standard") {
            plan = PLANS.STANDARD
        }
    }

    return {
        plan,
        limits: PLAN_LIMITS[plan],
        isLoaded: true
    }
}