import { CodepunkHeader } from "@/components/codepunk/header";
import { CodepunkHero } from "@/components/codepunk/hero";
import { CodepunkFooter } from "@/components/codepunk/footer";

export const metadata = {
    title: "Codepunk - Build new products for startups",
    description: "Our framework component is built to handle scaling demands with agility. Lightning-fast performance is our promise.",
};

export default function CodepunkPage() {
    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white relative overflow-hidden">
            {/* Background gradient overlay - more visible */}
            <div className="absolute inset-0 codepunk-bg-gradient"></div>

            {/* Additional gradient for better visibility */}
            <div className="absolute inset-0 codepunk-bg-gradient-overlay"></div>

            {/* Enhanced gradient for maximum visibility */}
            <div className="absolute inset-0 codepunk-bg-enhanced"></div>

            <div className="relative z-10">
                <CodepunkHeader />
                <main>
                    <CodepunkHero />
                </main>
                <CodepunkFooter />
            </div>
        </div>
    );
}
