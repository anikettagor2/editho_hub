import { format, startOfDay, startOfMonth, subDays, subMonths } from "date-fns";
import { Project, User } from "@/types/schema";

export type AdminAnalyticsRange = "Day" | "Week" | "Month" | "Year";

export type AdminAnalyticsPoint = {
    timestamp: number;
    display: string;
    revenue: number;
    profit: number;
    completedProjects: number;
    newClients: number;
    newTeam: number;
    totalProjects: number;
    clientPending: number;
    editorPending: number;
};

export type AdminAnalyticsSummary = {
    chartData: AdminAnalyticsPoint[];
    totalRevenue: number;
    totalProfit: number;
    totalCompletedProjects: number;
    totalClients: number;
    totalTeamMembers: number;
    totalProjects: number;
    clientPending: number;
    editorPending: number;
    lastPaymentDate: number | null;
};

const COMPLETED_PROJECT_STATUSES = new Set(["completed"]);
const TEAM_ROLES = new Set(["admin", "project_manager", "editor", "sales_executive"]);

export function getProjectRevenueValue(project: Project) {
    return Math.max(
        0,
        Number(project.totalCost ?? project.pricingTierPrice ?? project.budget ?? 0) || 0
    );
}

function createRangeBuckets(timeRange: AdminAnalyticsRange, now = new Date()) {
    let periods = 7;
    let getStartOfPeriod: (date: Date) => Date;
    let getFormatString = "EEE";
    let getSubPeriod: (date: Date, amount: number) => Date;

    switch (timeRange) {
        case "Day":
            periods = 24;
            getStartOfPeriod = (date) =>
                new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours());
            getFormatString = "HH:00";
            getSubPeriod = (date, amount) =>
                new Date(date.getTime() - amount * 60 * 60 * 1000);
            break;
        case "Week":
            periods = 7;
            getStartOfPeriod = startOfDay;
            getFormatString = "EEE";
            getSubPeriod = subDays;
            break;
        case "Month":
            periods = 30;
            getStartOfPeriod = startOfDay;
            getFormatString = "dd MMM";
            getSubPeriod = subDays;
            break;
        case "Year":
            periods = 12;
            getStartOfPeriod = startOfMonth;
            getFormatString = "MMM yyyy";
            getSubPeriod = subMonths;
            break;
    }

    return Array.from({ length: periods }).map((_, index) => {
        const date = getSubPeriod(now, periods - 1 - index);
        return {
            timestamp: getStartOfPeriod(date).getTime(),
            display: format(date, getFormatString),
            revenue: 0,
            profit: 0,
            completedProjects: 0,
            newClients: 0,
            newTeam: 0,
            totalProjects: 0,
            clientPending: 0,
            editorPending: 0,
        } satisfies AdminAnalyticsPoint;
    });
}

function findBucket(
    buckets: AdminAnalyticsPoint[],
    timestamp: number
) {
    return buckets.find((bucket, index) => {
        const nextTimestamp = index < buckets.length - 1 ? buckets[index + 1].timestamp : Number.POSITIVE_INFINITY;
        return timestamp >= bucket.timestamp && timestamp < nextTimestamp;
    }) || null;
}

export function buildAdminAnalytics(
    projects: Project[],
    users: User[],
    timeRange: AdminAnalyticsRange
): AdminAnalyticsSummary {
    const chartData = createRangeBuckets(timeRange);
    let lastPaymentDate: number | null = null;

    projects.forEach((project) => {
        if (!project.createdAt) return;

        const bucket = findBucket(chartData, project.createdAt);
        if (!bucket) return;

        const revenue = getProjectRevenueValue(project);
        const clientPending = Math.max(0, revenue - (project.amountPaid || 0));
        const editorPending =
            project.assignedEditorId && !project.editorPaid && project.clientHasDownloaded
                ? project.editorPrice || 0
                : 0;
        const profit = revenue - (project.editorPrice || 0);

        bucket.totalProjects += 1;
        bucket.revenue += revenue;
        bucket.clientPending += clientPending;
        bucket.editorPending += editorPending;
        bucket.profit += profit;

        if (COMPLETED_PROJECT_STATUSES.has(project.status)) {
            bucket.completedProjects += 1;
        }

        if ((project.amountPaid || 0) > 0) {
            const paymentTimestamp = project.updatedAt || project.createdAt;
            if (!lastPaymentDate || paymentTimestamp > lastPaymentDate) {
                lastPaymentDate = paymentTimestamp;
            }
        }
    });

    users.forEach((user) => {
        if (!user.createdAt) return;

        const bucket = findBucket(chartData, user.createdAt);
        if (!bucket) return;

        if (user.role === "client") {
            bucket.newClients += 1;
        } else if (TEAM_ROLES.has(user.role)) {
            bucket.newTeam += 1;
        }
    });

    return {
        chartData,
        totalRevenue: chartData.reduce((sum, item) => sum + item.revenue, 0),
        totalProfit: chartData.reduce((sum, item) => sum + item.profit, 0),
        totalCompletedProjects: chartData.reduce((sum, item) => sum + item.completedProjects, 0),
        totalClients: chartData.reduce((sum, item) => sum + item.newClients, 0),
        totalTeamMembers: chartData.reduce((sum, item) => sum + item.newTeam, 0),
        totalProjects: chartData.reduce((sum, item) => sum + item.totalProjects, 0),
        clientPending: chartData.reduce((sum, item) => sum + item.clientPending, 0),
        editorPending: chartData.reduce((sum, item) => sum + item.editorPending, 0),
        lastPaymentDate,
    };
}

export function buildAdminFinanceSummary(projects: Project[]) {
    const revenue = projects.reduce((sum, project) => sum + getProjectRevenueValue(project), 0);
    const clientPending = projects.reduce((sum, project) => {
        const pending = Math.max(0, getProjectRevenueValue(project) - (project.amountPaid || 0));
        return sum + pending;
    }, 0);
    const editorPending = projects.reduce((sum, project) => {
        if (project.assignedEditorId && !project.editorPaid && project.clientHasDownloaded) {
            return sum + (project.editorPrice || 0);
        }
        return sum;
    }, 0);
    const profit = projects.reduce((sum, project) => sum + (getProjectRevenueValue(project) - (project.editorPrice || 0)), 0);
    const lastPaymentDate = projects
        .filter((project) => (project.amountPaid || 0) > 0)
        .reduce<number | null>((latest, project) => {
            const paymentTimestamp = project.updatedAt || project.createdAt || null;
            if (!paymentTimestamp) return latest;
            return latest && latest > paymentTimestamp ? latest : paymentTimestamp;
        }, null);

    return {
        revenue,
        clientPending,
        editorPending,
        profit,
        totalProjects: projects.length,
        lastPaymentDate,
    };
}
