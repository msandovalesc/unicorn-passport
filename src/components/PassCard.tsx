import { CARD_SIZE, type CardProgress } from "@/lib/progress";
import { env } from "@/lib/env";
import { ProgramLogo } from "./ProgramLogo";
import { StampGrid } from "./StampGrid";

/** Web version of the wallet card. Same layout as the Apple/Google passes. */
export function PassCard({
  name,
  progress,
  qrSvg,
  newStamp,
}: {
  name: string;
  progress: CardProgress;
  qrSvg?: string;
  newStamp?: number;
}) {
  const next = progress.nextReward;
  return (
    <section className="pass" aria-label={`${env.PROGRAM_NAME} card`}>
      <div className="pass-head">
        <ProgramLogo tone="dark" width={140} />
        {progress.cardNumber > 1 && <div className="pass-label">Card #{progress.cardNumber}</div>}
      </div>

      <div className="pass-member">
        <div className="pass-label">Member</div>
        <div className="pass-name">{name}</div>
      </div>

      <StampGrid stamps={progress.stampsOnCard} newStamp={newStamp} />

      <div className="pass-foot">
        <div>
          <div className="pass-count">
            {progress.stampsOnCard} of {CARD_SIZE} stamps
          </div>
          <div className="pass-next">
            {progress.isComplete
              ? "Card complete! Your next stamp starts a fresh card."
              : next
                ? `${next.stampsToGo} more to ${next.item}`
                : "Keep stacking unicorns"}
          </div>
        </div>
        {qrSvg && <div className="pass-qr" dangerouslySetInnerHTML={{ __html: qrSvg }} aria-label="Your card QR code" role="img" />}
      </div>
    </section>
  );
}
