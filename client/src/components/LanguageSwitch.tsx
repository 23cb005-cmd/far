import { LANGUAGES, LANGUAGE_LABELS, type Language } from '@farmfair/shared';
import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getLanguage, setLanguage } from '@/lib/i18n';
import { useUser } from '@/store/auth';
import { authApi } from '@/lib/authApi';

/**
 * Language switch for the top bar.
 *
 * The choice is stored locally straight away so the UI changes instantly, and
 * also pushed to the profile for signed-in users so WhatsApp alerts and emails
 * arrive in the same language on every device.
 */
export function LanguageSwitch({ compact = false }: { compact?: boolean }) {
  const { t, i18n } = useTranslation();
  const user = useUser();
  const current = getLanguage();

  const onChange = (value: string) => {
    const language = value as Language;
    setLanguage(language);
    if (user && user.language !== language) {
      // Fire and forget: a failed sync must not block the UI change.
      void authApi.updateMe({ language }).catch(() => undefined);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={compact ? 'icon' : 'sm'}
          aria-label={t('language.change')}
          className="gap-2"
        >
          <Languages className="size-5 shrink-0" aria-hidden="true" />
          {!compact && (
            <span aria-hidden="true" className="text-sm font-medium">
              {LANGUAGE_LABELS[current]}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={i18n.language} onValueChange={onChange}>
          {LANGUAGES.map((language) => (
            <DropdownMenuRadioItem key={language} value={language}>
              {LANGUAGE_LABELS[language]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
