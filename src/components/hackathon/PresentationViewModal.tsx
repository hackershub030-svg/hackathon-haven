import { FileText, ExternalLink, Download } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface PresentationViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presentationUrl: string;
  teamName: string;
}

export function PresentationViewModal({
  open,
  onOpenChange,
  presentationUrl,
  teamName,
}: PresentationViewModalProps) {
  const isPdf = presentationUrl.toLowerCase().endsWith('.pdf');
  const isPpt = presentationUrl.toLowerCase().endsWith('.ppt') || 
                presentationUrl.toLowerCase().endsWith('.pptx');

  // Use Google Docs Viewer for PPT files
  const viewerUrl = isPpt 
    ? `https://docs.google.com/gview?url=${encodeURIComponent(presentationUrl)}&embedded=true`
    : presentationUrl;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Presentation - {teamName}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 min-h-[500px] bg-muted/30 rounded-lg overflow-hidden">
          <iframe
            src={viewerUrl}
            className="w-full h-full min-h-[500px] border-0"
            title={`Presentation by ${teamName}`}
            allowFullScreen
          />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button
            variant="outline"
            onClick={() => window.open(presentationUrl, '_blank')}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Open in New Tab
          </Button>
          <Button
            variant="outline"
            asChild
          >
            <a href={presentationUrl} download>
              <Download className="w-4 h-4 mr-2" />
              Download
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
