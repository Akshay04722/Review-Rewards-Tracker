import prisma from "../src/lib/prisma";
import { isValidCandidateUrl } from "../src/lib/crawler/domain-filter";

async function main() {
  console.log("Cleaning invalid records from database...");

  const all = await prisma.campaign.findMany({
    select: {
      id: true,
      canonicalUrl: true,
      platform: true,
      rewardAmount: true,
      directCampaignUrl: true,
    },
  });

  let deleted = 0;
  for (const c of all) {
    const isInvalid =
      c.platform === "Other" ||
      c.rewardAmount <= 0 ||
      !isValidCandidateUrl(c.canonicalUrl);

    if (isInvalid) {
      await prisma.statusHistory.deleteMany({ where: { campaignId: c.id } });
      await prisma.campaign.delete({ where: { id: c.id } });
      deleted++;
    }
  }

  console.log(`Deleted ${deleted} invalid non-campaign records.`);
  const remaining = await prisma.campaign.count();
  console.log(`Remaining valid campaigns in database: ${remaining}`);
}

main()
  .catch((err) => {
    console.error("Clean error:", err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
