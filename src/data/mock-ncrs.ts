
import { NCR, NCR_STATUS, NCR_SEVERITY } from "@/types/ncr";

export const mockNCRs: NCR[] = [
  {
    id: "NCR-2023-041",
    jobPart: {
      name: "J1005: Shaft",
      partNumber: "SH-101-A"
    },
    issueType: "Dimensional",
    reported: {
      date: "May 17, 2023",
      by: "Alex Wilson"
    },
    severity: NCR_SEVERITY.MAJOR,
    status: NCR_STATUS.PENDING_REVIEW,
    assignedTo: {
      id: "QA",
      initial: "QA",
      name: "Quality Manager"
    }
  },
  {
    id: "NCR-2023-038",
    jobPart: {
      name: "J1001: Valve Body",
      partNumber: "VB-100-A"
    },
    issueType: "Dimensional",
    reported: {
      date: "May 15, 2023",
      by: "John Smith"
    },
    severity: NCR_SEVERITY.CRITICAL,
    status: NCR_STATUS.IN_PROGRESS,
    assignedTo: {
      id: "SJ",
      initial: "SJ",
      name: "Sarah Johnson"
    }
  },
  {
    id: "NCR-2023-039",
    jobPart: {
      name: "J1002: Hydraulic Pump",
      partNumber: "HP-202-B"
    },
    issueType: "Material",
    reported: {
      date: "May 16, 2023",
      by: "Mike Davis"
    },
    severity: NCR_SEVERITY.MAJOR,
    status: NCR_STATUS.INVESTIGATION,
    assignedTo: {
      id: "AW",
      initial: "AW",
      name: "Alex Wilson"
    }
  },
  {
    id: "NCR-2023-040",
    jobPart: {
      name: "J1003: Gear Assembly",
      partNumber: "GA-305-C"
    },
    issueType: "Surface Finish",
    reported: {
      date: "May 16, 2023",
      by: "Sarah Johnson"
    },
    severity: NCR_SEVERITY.MINOR,
    status: NCR_STATUS.CORRECTIVE_ACTION,
    assignedTo: {
      id: "JS",
      initial: "JS",
      name: "John Smith"
    }
  },
  {
    id: "NCR-2023-035",
    jobPart: {
      name: "J1001: Valve Body",
      partNumber: "VB-100-B"
    },
    issueType: "Surface Finish",
    reported: {
      date: "May 10, 2023",
      by: "Mike Davis"
    },
    severity: NCR_SEVERITY.MINOR,
    status: NCR_STATUS.CLOSED,
    assignedTo: {
      id: "SJ",
      initial: "SJ",
      name: "Sarah Johnson"
    },
    closedDate: "May 12, 2023",
    closedBy: {
      id: "SJ",
      initial: "SJ",
      name: "Sarah Johnson"
    },
    resolution: "Rework"
  },
  {
    id: "NCR-2023-036",
    jobPart: {
      name: "J1004: Support Frame",
      partNumber: "SF-405-A"
    },
    issueType: "Dimensional",
    reported: {
      date: "May 11, 2023",
      by: "John Smith"
    },
    severity: NCR_SEVERITY.MAJOR,
    status: NCR_STATUS.CLOSED,
    assignedTo: {
      id: "QA",
      initial: "QA",
      name: "Quality Manager"
    },
    closedDate: "May 13, 2023",
    closedBy: {
      id: "QA",
      initial: "QA",
      name: "Quality Manager"
    },
    resolution: "Scrapped"
  }
];

export const getNCRsByStatus = (status: string) => {
  return mockNCRs.filter(ncr => ncr.status === status);
};

export const getActiveNCRs = () => {
  return mockNCRs.filter(ncr => ncr.status !== NCR_STATUS.CLOSED);
};

export const getClosedNCRs = () => {
  return mockNCRs.filter(ncr => ncr.status === NCR_STATUS.CLOSED);
};

export const getPendingReviewNCRs = () => {
  return mockNCRs.filter(ncr => ncr.status === NCR_STATUS.PENDING_REVIEW);
};
