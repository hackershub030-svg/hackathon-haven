import { useState, useRef } from 'react';
import { Upload, Check, Loader2, X, Image, Crop } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { ImageCropModal } from './ImageCropModal';

const DEFAULT_BANNERS = [
  {
    id: 'default-1',
    url: 'https://static.vecteezy.com/system/resources/thumbnails/069/192/964/small/modern-abstract-purple-wave-on-dark-background-tech-banner-corporate-business-concept-hi-tech-abstract-background-illustration-for-business-or-presentation-vector.jpg',
    label: 'Purple Wave',
    category: 'Tech',
  },
  {
    id: 'default-2',
    url: 'https://t3.ftcdn.net/jpg/04/67/96/14/360_F_467961418_UnS1ZAwAqbvVVMKExxqUNi0MUFTEJI83.jpg',
    label: 'Tech Abstract',
    category: 'Tech',
  },
  {
    id: 'default-3',
    url: 'https://img.freepik.com/free-vector/abstract-blue-geometric-shapes-background_1035-17545.jpg',
    label: 'Blue Geometric',
    category: 'Modern',
  },
  {
    id: 'default-4',
    url: 'https://img.freepik.com/free-vector/gradient-network-connection-background_23-2148865393.jpg',
    label: 'Network Grid',
    category: 'Tech',
  },
  {
    id: 'default-5',
    url: 'https://img.freepik.com/free-vector/gradient-hexagonal-background_23-2148958107.jpg',
    label: 'Hexagon Pattern',
    category: 'Modern',
  },
  {
    id: 'default-6',
    url: 'https://img.freepik.com/free-vector/colorful-gradient-background-modern-design_677411-3051.jpg',
    label: 'Colorful Gradient',
    category: 'Vibrant',
  },
  {
    id: 'default-7',
    url: 'https://img.freepik.com/free-vector/dark-gradient-background-with-copy-space_53876-99548.jpg',
    label: 'Dark Gradient',
    category: 'Minimal',
  },
  {
    id: 'default-8',
    url: 'https://img.freepik.com/free-vector/futuristic-technology-background_23-2148455648.jpg',
    label: 'Futuristic Lines',
    category: 'Tech',
  },
];

interface BannerSelectorProps {
  value: string;
  onChange: (url: string) => void;
}

export function BannerSelector({ value, onChange }: BannerSelectorProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [customBannerUrl, setCustomBannerUrl] = useState<string | null>(
    value && !DEFAULT_BANNERS.some((b) => b.url === value) ? value : null
  );
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isDefaultBanner = DEFAULT_BANNERS.some((b) => b.url === value);
  const isCustomBanner = value && !isDefaultBanner;

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload an image file',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 10MB for cropping, will compress after)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Maximum file size is 10MB',
        variant: 'destructive',
      });
      return;
    }

    // Create object URL for cropping
    const imageUrl = URL.createObjectURL(file);
    setImageToCrop(imageUrl);
    setCropModalOpen(true);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    setCropModalOpen(false);
    if (imageToCrop) {
      URL.revokeObjectURL(imageToCrop);
      setImageToCrop(null);
    }

    if (!user) return;

    setIsUploading(true);

    try {
      const filePath = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('hackathon-banners')
        .upload(filePath, croppedBlob, {
          contentType: 'image/jpeg',
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('hackathon-banners')
        .getPublicUrl(filePath);

      setCustomBannerUrl(publicUrl);
      onChange(publicUrl);

      toast({
        title: 'Upload successful',
        description: 'Your banner has been cropped and uploaded',
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload failed',
        description: error.message || 'Failed to upload banner',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveCustom = () => {
    setCustomBannerUrl(null);
    onChange(DEFAULT_BANNERS[0].url);
  };

  const getBannerType = () => {
    if (isCustomBanner) return 'custom';
    const defaultBanner = DEFAULT_BANNERS.find((b) => b.url === value);
    return defaultBanner?.id || 'default-1';
  };

  // Group banners by category
  const categories = [...new Set(DEFAULT_BANNERS.map((b) => b.category))];

  return (
    <div className="space-y-4">
      <Label className="flex items-center gap-2">
        <Image className="w-4 h-4" />
        Hackathon Banner
      </Label>

      <div className="space-y-6">
        {/* Default Banners by Category */}
        {categories.map((category) => (
          <div key={category}>
            <p className="text-sm font-medium text-muted-foreground mb-3">{category}</p>
            <RadioGroup
              value={getBannerType()}
              onValueChange={(val) => {
                if (val !== 'custom') {
                  const banner = DEFAULT_BANNERS.find((b) => b.id === val);
                  if (banner) onChange(banner.url);
                }
              }}
              className="grid grid-cols-2 md:grid-cols-4 gap-3"
            >
              {DEFAULT_BANNERS.filter((b) => b.category === category).map((banner) => (
                <div key={banner.id} className="relative">
                  <RadioGroupItem
                    value={banner.id}
                    id={banner.id}
                    className="peer sr-only"
                  />
                  <label
                    htmlFor={banner.id}
                    className={cn(
                      'block cursor-pointer rounded-lg overflow-hidden border-2 transition-all',
                      'hover:border-primary/50 hover:scale-[1.02]',
                      value === banner.url
                        ? 'border-primary ring-2 ring-primary/20'
                        : 'border-border'
                    )}
                  >
                    <div className="aspect-[3/1] relative">
                      <img
                        src={banner.url}
                        alt={banner.label}
                        className="w-full h-full object-cover"
                      />
                      {value === banner.url && (
                        <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                          <Check className="w-3 h-3 text-primary-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="p-1.5 bg-muted/50">
                      <p className="text-xs font-medium text-center truncate">{banner.label}</p>
                    </div>
                  </label>
                </div>
              ))}
            </RadioGroup>
          </div>
        ))}

        {/* Custom Banner Section */}
        <div className="pt-4 border-t border-border">
          <p className="text-sm font-medium text-muted-foreground mb-3">Custom Banner</p>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            disabled={isUploading}
          />

          {customBannerUrl ? (
            <div className="space-y-3">
              <div
                className={cn(
                  'rounded-lg overflow-hidden border-2 transition-all',
                  isCustomBanner
                    ? 'border-primary ring-2 ring-primary/20'
                    : 'border-border cursor-pointer hover:border-primary/50'
                )}
                onClick={() => onChange(customBannerUrl)}
              >
                <div className="aspect-[3/1] relative">
                  <img
                    src={customBannerUrl}
                    alt="Custom banner"
                    className="w-full h-full object-cover"
                  />
                  {isCustomBanner && (
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-4 h-4 text-primary-foreground" />
                    </div>
                  )}
                </div>
                <div className="p-2 bg-muted/50 flex items-center justify-between">
                  <p className="text-sm font-medium">Custom Banner</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveCustom();
                    }}
                    className="h-7 text-muted-foreground hover:text-destructive"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Remove
                  </Button>
                </div>
              </div>
              
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="w-full"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Crop className="w-4 h-4 mr-2" />
                    Upload & Crop New Banner
                  </>
                )}
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-full"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Custom Banner
                </>
              )}
            </Button>
          )}
          
          <p className="text-xs text-muted-foreground mt-2">
            Upload an image and crop it to the perfect banner size (3:1 aspect ratio). Max file size: 10MB
          </p>
        </div>
      </div>

      {/* Image Crop Modal */}
      {imageToCrop && (
        <ImageCropModal
          open={cropModalOpen}
          onClose={() => {
            setCropModalOpen(false);
            if (imageToCrop) {
              URL.revokeObjectURL(imageToCrop);
              setImageToCrop(null);
            }
          }}
          imageSrc={imageToCrop}
          onCropComplete={handleCropComplete}
          aspectRatio={3}
        />
      )}
    </div>
  );
}
