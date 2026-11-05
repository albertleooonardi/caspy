import { Check } from 'lucide-react';

const steps = ['Persuade Caspy', 'Generate candy', 'Mint your NFT', 'Collect & trade'];

export function RewardJourney({ stage }: { stage: number }) {
  return <ol className="reward-journey" aria-label="Your candy journey">
    {steps.map((label, index) => <li key={label} className={index < stage ? 'complete' : index === stage ? 'current' : ''} aria-current={index === stage ? 'step' : undefined}>
      <span className="journey-number" aria-hidden="true">{index < stage ? <Check size={15} /> : String(index + 1).padStart(2, '0')}</span>
      <span>{label}</span>
    </li>)}
  </ol>;
}
