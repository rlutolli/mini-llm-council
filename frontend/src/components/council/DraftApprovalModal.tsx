import { useState } from 'react';
import { motion } from 'framer-motion';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileText, Sparkles, Pencil, CheckCircle } from 'lucide-react';

interface DraftApprovalModalProps {
    isOpen: boolean;
    onClose: () => void;
    draft: {
        summary: string;
        context: string;
        keyPoints: string[];
    } | null;
    isGenerating: boolean;
    onApprove: (editedDraft: string) => void;
    onRegenerate: () => void;
}

export function DraftApprovalModal({
    isOpen,
    onClose,
    draft,
    isGenerating,
    onApprove,
    onRegenerate,
}: DraftApprovalModalProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editedSummary, setEditedSummary] = useState('');

    // Initialize edited summary when draft changes
    const handleEdit = () => {
        setEditedSummary(draft?.summary || '');
        setIsEditing(true);
    };

    const handleApprove = () => {
        onApprove(isEditing ? editedSummary : draft?.summary || '');
        setIsEditing(false);
        setEditedSummary('');
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Draft Resolution
                    </DialogTitle>
                    <DialogDescription>
                        Review the draft before sending to the Council. You can edit or regenerate it.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Generating State */}
                    {isGenerating && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex flex-col items-center justify-center py-12"
                        >
                            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                            <p className="text-sm text-muted-foreground">Drafting resolution from conversation...</p>
                        </motion.div>
                    )}

                    {/* Draft Content */}
                    {!isGenerating && draft && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-4"
                        >
                            {/* Summary */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-muted-foreground">Summary</span>
                                    {!isEditing && (
                                        <Button variant="ghost" size="sm" onClick={handleEdit}>
                                            <Pencil className="h-3 w-3 mr-1" />
                                            Edit
                                        </Button>
                                    )}
                                </div>
                                {isEditing ? (
                                    <Textarea
                                        value={editedSummary}
                                        onChange={(e) => setEditedSummary(e.target.value)}
                                        className="min-h-[120px] resize-none"
                                        placeholder="Edit the draft summary..."
                                    />
                                ) : (
                                    <div className="p-4 bg-secondary/50 rounded-lg border border-border">
                                        <p className="text-sm">{draft.summary}</p>
                                    </div>
                                )}
                            </div>

                            {/* Context */}
                            <div className="space-y-2">
                                <span className="text-sm font-medium text-muted-foreground">Context</span>
                                <div className="p-4 bg-secondary/30 rounded-lg border border-border/50 text-xs text-muted-foreground">
                                    {draft.context}
                                </div>
                            </div>

                            {/* Key Points */}
                            {draft.keyPoints.length > 0 && (
                                <div className="space-y-2">
                                    <span className="text-sm font-medium text-muted-foreground">Key Points</span>
                                    <div className="flex flex-wrap gap-2">
                                        {draft.keyPoints.map((point, i) => (
                                            <Badge key={i} variant="secondary" className="text-xs">
                                                {point}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}
                </div>

                <DialogFooter className="flex-col sm:flex-row gap-2">
                    {!isGenerating && draft && (
                        <>
                            <Button variant="outline" onClick={onRegenerate} className="gap-2">
                                <Sparkles className="h-4 w-4" />
                                Regenerate
                            </Button>
                            <Button variant="outline" onClick={onClose}>
                                Cancel
                            </Button>
                            <Button onClick={handleApprove} className="gap-2 bg-primary">
                                <CheckCircle className="h-4 w-4" />
                                Approve & Send to Council
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
