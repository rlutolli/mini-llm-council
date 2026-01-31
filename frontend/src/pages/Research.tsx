import { ResearchPanel } from '@/components/research';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Research() {
    return (
        <div className="min-h-screen bg-zinc-950 text-white">
            {/* Header */}
            <header className="flex items-center gap-4 px-6 py-4 border-b border-zinc-800">
                <Link to="/">
                    <Button variant="ghost" size="sm">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Chat
                    </Button>
                </Link>
                <h1 className="text-xl font-bold">Deep Research</h1>
            </header>

            {/* Main Content */}
            <main className="max-w-4xl mx-auto p-6">
                <ResearchPanel />
            </main>
        </div>
    );
}
