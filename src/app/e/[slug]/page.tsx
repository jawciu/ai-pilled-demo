import Meetup from '@/components/meetup';
export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <Meetup slug={slug} />;
}
