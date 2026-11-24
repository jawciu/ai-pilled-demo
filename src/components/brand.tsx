// Original pixel-pill assets and wordmark styling from https://ai-pilled.co/.
export default function Brand({ light = false }: { light?: boolean }) {
  return <>
    <img className="brand-logo" src={`/brand/ai-pilled-${light ? 'paper' : 'ink'}.svg`} width={36} height={30} alt="" />
    <span className="brand-wordmark">AI Pilled</span>
  </>;
}
