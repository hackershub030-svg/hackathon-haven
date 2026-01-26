import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface GenderSelectProps {
  value: string;
  onValueChange: (value: string) => void;
}

const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'non-binary', label: 'Non-binary' },
  { value: 'prefer-not-to-say', label: 'Prefer not to say' },
  { value: 'other', label: 'Other' },
];

export function GenderSelect({ value, onValueChange }: GenderSelectProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="bg-muted/50 border-border">
        <SelectValue placeholder="Select gender" />
      </SelectTrigger>
      <SelectContent>
        {GENDER_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
