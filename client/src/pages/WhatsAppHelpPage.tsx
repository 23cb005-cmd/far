import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const COMMANDS: Array<{ en: string; ta: string; descKey: string }> = [
  { en: 'HELP / MENU', ta: 'உதவி', descKey: 'help' },
  { en: 'PRICE <crop>', ta: 'விலை <பயிர்>', descKey: 'price' },
  { en: 'SELL <crop> <kg> [price]', ta: 'விற்க <பயிர்> <கிலோ> [விலை]', descKey: 'sell' },
  { en: 'LISTINGS', ta: 'பட்டியல்', descKey: 'listings' },
  { en: 'OFFERS', ta: 'சலுகைகள்', descKey: 'offers' },
  { en: 'ACCEPT / REJECT <code>', ta: 'ஏற்க / நிராகரி <code>', descKey: 'acceptReject' },
  { en: 'ORDERS', ta: 'ஆர்டர்', descKey: 'orders' },
  { en: 'CONFIRM <code>', ta: 'உறுதி <code>', descKey: 'confirm' },
  { en: 'STOP / START', ta: 'STOP / START', descKey: 'stopStart' },
  { en: 'LANG EN / LANG TA', ta: 'LANG EN / LANG TA', descKey: 'lang' },
];

export default function WhatsAppHelpPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t('whatsapp.title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('whatsapp.subtitle')}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{t('whatsapp.join.title')}</CardTitle>
          <CardDescription>{t('whatsapp.join.body')}</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('whatsapp.commands.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4">English</th>
                  <th className="py-2 pr-4">தமிழ்</th>
                  <th className="py-2">{t('whatsapp.commands.meaning')}</th>
                </tr>
              </thead>
              <tbody>
                {COMMANDS.map((c) => (
                  <tr key={c.en} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-mono">{c.en}</td>
                    <td className="py-2 pr-4 font-mono">{c.ta}</td>
                    <td className="py-2">{t(`whatsapp.commands.${c.descKey}`)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
