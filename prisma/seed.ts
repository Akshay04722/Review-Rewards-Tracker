import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding ReviewRewards Tracker database with sample campaigns...");

  // Clean existing data for reproducible seed
  await prisma.statusHistory.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.searchQuery.deleteMany();
  await prisma.platform.deleteMany();
  await prisma.crawlRun.deleteMany();

  // 1. Seed Platforms
  const platforms = [
    { slug: "G2", name: "G2", baseUrl: "https://www.g2.com" },
    { slug: "Capterra", name: "Capterra", baseUrl: "https://www.capterra.com" },
    { slug: "TrustRadius", name: "TrustRadius", baseUrl: "https://www.trustradius.com" },
    { slug: "GartnerPeerInsights", name: "Gartner Peer Insights", baseUrl: "https://www.gartner.com/reviews" },
    { slug: "SoftwareAdvice", name: "Software Advice", baseUrl: "https://www.softwareadvice.com" },
    { slug: "GetApp", name: "GetApp", baseUrl: "https://www.getapp.com" },
    { slug: "Trustpilot", name: "Trustpilot", baseUrl: "https://www.trustpilot.com" },
  ];

  for (const p of platforms) {
    await prisma.platform.create({ data: p });
  }

  // 2. Seed 10 realistic campaigns across platforms
  const sampleCampaigns = [
    {
      vendorName: "Datadog",
      domain: "datadoghq.com",
      productName: "Datadog Cloud Monitoring",
      pageTitle: "Datadog G2 Review Incentive Program",
      canonicalUrl: "https://www.datadoghq.com/reviews/g2-incentive",
      platform: "G2",
      directCampaignUrl: "https://www.g2.com/products/datadog/take_survey?campaign=datadog_q4_rewards",
      rewardAmount: 25,
      rewardCurrency: "USD",
      rewardType: "Amazon",
      description: "Datadog is offering a $25 Amazon gift card for verified infrastructure and engineering leads who publish a detailed review on G2.",
      rewardLimit: "First 50 reviewers",
      eligibility: "Current customers only, work email required",
      deadlineDate: new Date("2026-12-31T23:59:59Z"),
      status: "ACTIVE",
      confidence: 0.95,
      historyReason: "Active future deadline and verified direct G2 survey URL",
    },
    {
      vendorName: "Asana",
      domain: "asana.com",
      productName: "Asana Work Management",
      pageTitle: "Share your Asana Feedback on Capterra",
      canonicalUrl: "https://asana.com/community/capterra-rewards",
      platform: "Capterra",
      directCampaignUrl: "https://www.capterra.com/p/10928/Asana/reviews/new/?incentive=true",
      rewardAmount: 30,
      rewardCurrency: "USD",
      rewardType: "Visa",
      description: "Earn a $30 prepaid Visa card by reviewing Asana on Capterra. Open to team managers and verified project collaborators.",
      rewardLimit: "First 100 reviewers",
      eligibility: "Active Asana workspace user",
      deadlineDate: new Date("2026-11-30T23:59:59Z"),
      status: "ACTIVE",
      confidence: 0.94,
      historyReason: "Valid Capterra review submission link with future deadline",
    },
    {
      vendorName: "Sentry",
      domain: "sentry.io",
      productName: "Sentry Error Monitoring",
      pageTitle: "Sentry on TrustRadius: Developer Rewards",
      canonicalUrl: "https://sentry.io/review-rewards-trustradius",
      platform: "TrustRadius",
      directCampaignUrl: "https://www.trustradius.com/products/sentry/reviews/new",
      rewardAmount: 25,
      rewardCurrency: "USD",
      rewardType: "UberEats",
      description: "Sentry is distributing $25 UberEats or Amazon vouchers for developers writing genuine feedback on TrustRadius.",
      rewardLimit: "First 75 verified users",
      eligibility: "Software developers with connected GitHub account",
      deadlineDate: new Date("2026-12-15T23:59:59Z"),
      status: "ACTIVE",
      confidence: 0.92,
      historyReason: "Active TrustRadius review link tested and functional",
    },
    {
      vendorName: "ClickUp",
      domain: "clickup.com",
      productName: "ClickUp Productivity Suite",
      pageTitle: "ClickUp on Gartner Peer Insights Rewards",
      canonicalUrl: "https://clickup.com/promotions/gartner-peer-insights-25",
      platform: "GartnerPeerInsights",
      directCampaignUrl: "https://www.gartner.com/reviews/survey/home?refVal=clickup_incentive",
      rewardAmount: 25,
      rewardCurrency: "USD",
      rewardType: "Visa",
      description: "Gartner Peer Insights offers a $25 Visa card for verified enterprise users reviewing ClickUp.",
      rewardLimit: "First 50 reviewers",
      eligibility: "Corporate work email, enterprise plan users",
      deadlineDate: new Date("2026-10-31T23:59:59Z"),
      status: "ACTIVE",
      confidence: 0.96,
      historyReason: "Official Gartner Peer Insights partner link confirmed",
    },
    {
      vendorName: "Airtable",
      domain: "airtable.com",
      productName: "Airtable App Platform",
      pageTitle: "Airtable on Software Advice - Review Incentive",
      canonicalUrl: "https://airtable.com/lp/software-advice-review-giftcard",
      platform: "SoftwareAdvice",
      directCampaignUrl: "https://www.softwareadvice.com/productivity/airtable-profile/review/",
      rewardAmount: 20,
      rewardCurrency: "USD",
      rewardType: "Amazon",
      description: "Share your database workflow experience on Software Advice and claim a $20 Amazon digital gift code.",
      rewardLimit: "Limited to 100 participants",
      eligibility: "Workspace owners and creators",
      deadlineDate: null,
      status: "LIKELY_ACTIVE",
      confidence: 0.78,
      historyReason: "Landing page live with valid direct link; no explicit end date specified",
    },
    {
      vendorName: "Monday.com",
      domain: "monday.com",
      productName: "monday.com Work OS",
      pageTitle: "monday.com Capterra Review Card Campaign",
      canonicalUrl: "https://monday.com/lp/capterra-gift-card-incentive",
      platform: "Capterra",
      directCampaignUrl: "https://www.capterra.com/p/133590/monday-com/reviews/new/?utm_campaign=monday_incentive",
      rewardAmount: 25,
      rewardCurrency: "USD",
      rewardType: "Amazon",
      description: "Write an authentic review of monday.com on Capterra and get a $25 Amazon voucher upon publication.",
      rewardLimit: "First 50 reviews",
      eligibility: "Pro and Enterprise tier users",
      deadlineDate: null,
      status: "LIKELY_ACTIVE",
      confidence: 0.8,
      historyReason: "Capterra review link reachable; recent campaign activity recorded",
    },
    {
      vendorName: "GitLab",
      domain: "gitlab.com",
      productName: "GitLab DevSecOps Platform",
      pageTitle: "GitLab G2 Community Review Incentive",
      canonicalUrl: "https://about.gitlab.com/community/g2-review-rewards",
      platform: "G2",
      directCampaignUrl: "https://www.g2.com/products/gitlab/take_survey",
      rewardAmount: 25,
      rewardCurrency: "USD",
      rewardType: "Donation",
      description: "GitLab lets you choose between a $25 Amazon gift card or a $25 charitable donation to Girls Who Code for reviewing GitLab on G2.",
      rewardLimit: "First 100 reviewers",
      eligibility: "Registered DevOps engineers",
      deadlineDate: new Date("2026-12-01T23:59:59Z"),
      status: "ACTIVE",
      confidence: 0.91,
      historyReason: "Active donation incentive program on G2",
    },
    {
      vendorName: "Zoom",
      domain: "zoom.us",
      productName: "Zoom Workplace",
      pageTitle: "Zoom TrustRadius Review Initiative",
      canonicalUrl: "https://zoom.us/promo/trustradius-verified-review",
      platform: "TrustRadius",
      directCampaignUrl: "https://www.trustradius.com/products/zoom/reviews/new",
      rewardAmount: 15,
      rewardCurrency: "USD",
      rewardType: "Cash",
      description: "Receive a $15 PayPal cash transfer or gift card by submitting a verified review of Zoom Workplace on TrustRadius.",
      rewardLimit: "Open quota",
      eligibility: "Business account administrators",
      deadlineDate: null,
      status: "LIKELY_ACTIVE",
      confidence: 0.76,
      historyReason: "Ongoing customer feedback incentive without stated cut-off",
    },
    {
      vendorName: "Notion",
      domain: "notion.so",
      productName: "Notion Workspace",
      pageTitle: "Review Notion on GetApp - $25 Reward",
      canonicalUrl: "https://notion.so/community/getapp-review-card",
      platform: "GetApp",
      directCampaignUrl: "https://www.getapp.com/p/notion/reviews/new/?reward=25",
      rewardAmount: 25,
      rewardCurrency: "USD",
      rewardType: "Amazon",
      description: "Share how Notion powers your documents and knowledge base on GetApp to claim a $25 Amazon Gift Card.",
      rewardLimit: "First 40 reviewers",
      eligibility: "Active team workspace members",
      deadlineDate: new Date("2026-11-15T23:59:59Z"),
      status: "ACTIVE",
      confidence: 0.93,
      historyReason: "Direct GetApp review submission link operational",
    },
    {
      vendorName: "HubSpot",
      domain: "hubspot.com",
      productName: "HubSpot Marketing Hub",
      pageTitle: "HubSpot G2 Review Reward Program - Summer Campaign",
      canonicalUrl: "https://hubspot.com/rewards/leave-a-review-g2",
      platform: "G2",
      directCampaignUrl: "https://www.g2.com/products/hubspot-marketing-hub/take_survey?campaign=summer24",
      rewardAmount: 25,
      rewardCurrency: "USD",
      rewardType: "Amazon",
      description: "HubSpot offered a $25 Amazon gift card for verified marketing leaders reviewing Marketing Hub on G2.",
      rewardLimit: "All gift cards claimed",
      eligibility: "Marketing Hub subscribers",
      deadlineDate: new Date("2026-06-30T23:59:59Z"),
      status: "EXPIRED",
      confidence: 0.98,
      historyReason: "Campaign deadline has passed and page displays 'Offer has ended'",
    },
  ];

  for (const item of sampleCampaigns) {
    const vendor = await prisma.vendor.create({
      data: {
        name: item.vendorName,
        domain: item.domain,
      },
    });

    const campaign = await prisma.campaign.create({
      data: {
        vendorId: vendor.id,
        productName: item.productName,
        pageTitle: item.pageTitle,
        canonicalUrl: item.canonicalUrl,
        platform: item.platform,
        directCampaignUrl: item.directCampaignUrl,
        rewardAmount: item.rewardAmount,
        rewardCurrency: item.rewardCurrency,
        rewardType: item.rewardType,
        description: item.description,
        rewardLimit: item.rewardLimit,
        eligibility: item.eligibility,
        deadlineDate: item.deadlineDate,
        status: item.status,
        confidence: item.confidence,
        consecutiveFails: item.status === "EXPIRED" ? 2 : 0,
        lastCheckedAt: new Date(),
        firstSeenAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        lastSeenAt: new Date(),
      },
    });

    await prisma.statusHistory.create({
      data: {
        campaignId: campaign.id,
        previousStatus: null,
        newStatus: item.status,
        confidence: item.confidence,
        reason: item.historyReason,
        checkedAt: new Date(),
      },
    });
  }

  // Create an initial mock crawl run in database
  await prisma.crawlRun.create({
    data: {
      trigger: "MANUAL",
      status: "COMPLETED",
      startedAt: new Date(Date.now() - 3600000),
      endedAt: new Date(Date.now() - 3500000),
      totalCandidates: 14,
      extractedCount: 10,
      verifiedCount: 10,
      errorCount: 1,
      logs: JSON.stringify([
        "Discovered 14 candidate URLs across G2, Capterra, TrustRadius, Gartner Peer Insights",
        "Deduplicated to 10 unique canonical campaigns",
        "Filtered 1 URL disallowed by robots.txt",
        "Verified 10 campaigns with active direct survey links",
      ]),
    },
  });

  console.log("Database seeded successfully with 10 sample campaigns and history!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
