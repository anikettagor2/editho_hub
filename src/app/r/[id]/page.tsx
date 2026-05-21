import { redirect } from "next/navigation";

type Props = {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

// Short redirect: /r/[id] → /review/[id]
// This is used for shareable review links copied from the dashboard
export default async function ShortReviewRedirect({ params, searchParams }: Props) {
    const { id } = await params;
    const resolvedSearchParams = await searchParams;
    const cToken = resolvedSearchParams.cToken;

    if (cToken && typeof cToken === "string") {
        redirect(`/review/${id}?cToken=${cToken}`);
    }
    
    redirect(`/review/${id}`);
}

