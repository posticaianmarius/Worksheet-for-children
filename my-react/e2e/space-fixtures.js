export function spaceContextFor(user) {
  const teacher = user?.role === "TEACHER";
  return {
    spaceId: 1,
    spaces: [
      {
        id: 1,
        name: "Teaching space",
        owner: teacher,
        manageStudentAccess: teacher,
      },
    ],
    student: teacher
      ? null
      : {
          id: user?.id ?? 2,
          userId: user?.id ?? 2,
          name: user?.name ?? "Student",
          archivedAt: null,
        },
    owner: teacher,
    manageStudentAccess: teacher,
  };
}
