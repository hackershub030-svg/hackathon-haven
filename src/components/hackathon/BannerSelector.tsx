import { useState, useRef } from 'react';
import { Upload, Check, Loader2, X, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

const DEFAULT_BANNERS = [
  {
    id: 'default-1',
    url: 'https://static.vecteezy.com/system/resources/thumbnails/069/192/964/small/modern-abstract-purple-wave-on-dark-background-tech-banner-corporate-business-concept-hi-tech-abstract-background-illustration-for-business-or-presentation-vector.jpg',
    label: 'Purple Wave',
  },
  {
    id: 'default-2',
    url: 'https://t3.ftcdn.net/jpg/04/67/96/14/360_F_467961418_UnS1ZAwAqbvVVMKExxqUNi0MUFTEJI83.jpg',
    label: 'Tech Abstract',
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

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Maximum file size is 5MB',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('hackathon-banners')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('hackathon-banners')
        .getPublicUrl(filePath);

      setCustomBannerUrl(publicUrl);
      onChange(publicUrl);

      toast({
        title: 'Upload successful',
        description: 'Your banner has been uploaded',
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
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveCustom = () => {
    setCustomBannerUrl(null);
    // Select first default banner
    onChange(DEFAULT_BANNERS[0].url);
  };

  const getBannerType = () => {
    if (isCustomBanner) return 'custom';
    const defaultBanner = DEFAULT_BANNERS.find((b) => b.url === value);
    return defaultBanner?.id || 'default-1';
  };

  return (
    <div className="space-y-4">
      <Label className="flex items-center gap-2">
        <Image className="w-4 h-4" />
        Hackathon Banner
      </Label>

      <div className="space-y-4">
        {/* Default Banners */}
        <div>
          <p className="text-sm text-muted-foreground mb-3">Choose a default banner:</p>
          <RadioGroup
            value={getBannerType()}
            onValueChange={(val) => {
              if (val !== 'custom') {
                const banner = DEFAULT_BANNERS.find((b) => b.id === val);
                if (banner) onChange(banner.url);
              }
            }}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            {DEFAULT_BANNERS.map((banner) => (
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
                    'hover:border-primary/50',
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
                      <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                        <Check className="w-4 h-4 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="p-2 bg-muted/50">
                    <p className="text-sm font-medium text-center">{banner.label}</p>
                  </div>
                </label>
              </div>
            ))}
          </RadioGroup>
        </div>

        {/* Custom Banner Section */}
        <div className="pt-4 border-t border-border">
          <p className="text-sm text-muted-foreground mb-3">Or upload a custom banner:</p>
          
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
                    <Upload className="w-4 h-4 mr-2" />
                    Replace Custom Banner
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
            Recommended size: 1200x400 pixels. Max file size: 5MB
          </p>
        </div>
      </div>
    </div>
  );
}
