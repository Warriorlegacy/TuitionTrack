"use client";

import { create } from "zustand";

type PortalFiltersStore = {
  studentSearch: string;
  homeworkSearch: string;
  homeworkStatus: "all" | "pending" | "completed";
  attendanceDate: string;
  feeStatus: "all" | "paid" | "unpaid" | "overdue";
  testSearch: string;
  announcementSearch: string;
  setStudentSearch: (value: string) => void;
  setHomeworkSearch: (value: string) => void;
  setHomeworkStatus: (value: PortalFiltersStore["homeworkStatus"]) => void;
  setAttendanceDate: (value: string) => void;
  setFeeStatus: (value: PortalFiltersStore["feeStatus"]) => void;
  setTestSearch: (value: string) => void;
  setAnnouncementSearch: (value: string) => void;
};

export const usePortalFiltersStore = create<PortalFiltersStore>((set) => ({
  studentSearch: "",
  homeworkSearch: "",
  homeworkStatus: "all",
  attendanceDate: new Date().toISOString().slice(0, 10),
  feeStatus: "all",
  testSearch: "",
  announcementSearch: "",
  setStudentSearch: (value) => set({ studentSearch: value }),
  setHomeworkSearch: (value) => set({ homeworkSearch: value }),
  setHomeworkStatus: (value) => set({ homeworkStatus: value }),
  setAttendanceDate: (value) => set({ attendanceDate: value }),
  setFeeStatus: (value) => set({ feeStatus: value }),
  setTestSearch: (value) => set({ testSearch: value }),
  setAnnouncementSearch: (value) => set({ announcementSearch: value }),
}));
