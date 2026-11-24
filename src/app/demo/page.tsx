import Meetup from '@/components/meetup';
export default async function DemoPage({ searchParams }: { searchParams: Promise<{ presenter?: string }> }) {
  const presenter = (await searchParams).presenter === '1';
  return <Meetup key={presenter ? 'presenter' : 'rehearsal'} slug="demo" demo presenter={presenter} />;
}
