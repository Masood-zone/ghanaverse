import { FoundationPage } from "@/components/layout/foundation-page";
import { requireUserPage } from "@/lib/auth/access";
export default async function ProfilesPage() { await requireUserPage("/profiles"); return <FoundationPage eyebrow="Profiles" title="Your profile space is ready." description="Profile management is a protected foundation placeholder." />; }
