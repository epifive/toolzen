"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Panel, Segmented, Stat, ToolColumns } from "@/components/tool-ui";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { cn, uid } from "@/lib/utils";
import { checkNumber, formatNumber } from "@/tools/lib/calc";
import { EmptyResult, NumberField, useTrackResult } from "@/tools/lib/calc-ui";

type ScaleId = "4" | "10";

interface Grade {
  letter: string;
  points: number;
}

const SCALES: Record<ScaleId, { max: number; label: string; grades: Grade[] }> = {
  "4": {
    max: 4,
    label: "4.0 scale",
    grades: [
      { letter: "A+", points: 4 },
      { letter: "A", points: 4 },
      { letter: "A−", points: 3.7 },
      { letter: "B+", points: 3.3 },
      { letter: "B", points: 3 },
      { letter: "B−", points: 2.7 },
      { letter: "C+", points: 2.3 },
      { letter: "C", points: 2 },
      { letter: "C−", points: 1.7 },
      { letter: "D+", points: 1.3 },
      { letter: "D", points: 1 },
      { letter: "D−", points: 0.7 },
      { letter: "F", points: 0 },
    ],
  },
  "10": {
    max: 10,
    label: "10-point scale",
    grades: [
      { letter: "O", points: 10 },
      { letter: "A+", points: 9 },
      { letter: "A", points: 8 },
      { letter: "B+", points: 7 },
      { letter: "B", points: 6 },
      { letter: "C", points: 5 },
      { letter: "P", points: 4 },
      { letter: "F", points: 0 },
    ],
  },
};

interface Course {
  id: string;
  name: string;
  credits: string;
  /** Index into the current scale's grade list. */
  grade: number;
}

const MAX_COURSES = 40;
const MAX_CREDITS = 30;

function newCourse(): Course {
  return { id: uid(), name: "", credits: "", grade: 1 };
}

/** The grade on the other scale whose points are proportionally closest. */
function convertGrade(index: number, from: ScaleId, to: ScaleId): number {
  const share = SCALES[from].grades[index].points / SCALES[from].max;
  const target = SCALES[to];
  let best = 0;
  target.grades.forEach((g, i) => {
    if (Math.abs(g.points / target.max - share) < Math.abs(target.grades[best].points / target.max - share)) best = i;
  });
  return best;
}

export default function GpaCalculator() {
  const [scaleId, setScaleId] = useState<ScaleId>("4");
  const [courses, setCourses] = useState<Course[]>(() => [newCourse(), newCourse(), newCourse(), newCourse()]);
  const [previousGpa, setPreviousGpa] = useState("");
  const [previousCredits, setPreviousCredits] = useState("");
  const scale = SCALES[scaleId];

  const rows = courses.map((course) => ({ course, check: checkNumber(course.credits, { min: 0, exclusiveMin: true, max: MAX_CREDITS }) }));
  const counted = rows.filter((r) => r.check.value !== null);
  const credits = counted.reduce((sum, r) => sum + (r.check.value ?? 0), 0);
  const qualityPoints = counted.reduce((sum, r) => sum + (r.check.value ?? 0) * scale.grades[r.course.grade].points, 0);
  const gpa = credits > 0 ? qualityPoints / credits : null;

  const previousGpaCheck = checkNumber(previousGpa, { min: 0, max: scale.max });
  const previousCreditsCheck = checkNumber(previousCredits, { min: 0, exclusiveMin: true, max: 1000 });
  const hasPrevious = previousGpaCheck.value !== null && previousCreditsCheck.value !== null;
  const cumulative =
    gpa !== null && hasPrevious
      ? (qualityPoints + (previousGpaCheck.value ?? 0) * (previousCreditsCheck.value ?? 0)) /
        (credits + (previousCreditsCheck.value ?? 0))
      : null;

  useTrackResult(gpa === null ? null : `${gpa}-${cumulative}`);

  function updateCourse(id: string, patch: Partial<Course>) {
    setCourses((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function changeScale(next: ScaleId) {
    setCourses((prev) => prev.map((c) => ({ ...c, grade: convertGrade(c.grade, scaleId, next) })));
    setScaleId(next);
  }

  return (
    <ToolColumns>
      <div className="space-y-4">
        <Panel
          title="Courses"
          actions={
            <Segmented<ScaleId>
              label="Grading scale"
              value={scaleId}
              onChange={changeScale}
              options={[
                { value: "4", label: "4.0" },
                { value: "10", label: "10-point" },
              ]}
            />
          }
        >
          <div className="hidden grid-cols-[1fr_5.5rem_7.5rem_2.25rem] gap-2 pb-1.5 text-xs text-muted sm:grid">
            <span>Course (optional)</span>
            <span>Credits</span>
            <span>Grade</span>
          </div>
          <ul className="space-y-3 sm:space-y-2">
            {rows.map(({ course, check }, index) => (
              <li key={course.id}>
                <div className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_5.5rem_7.5rem_2.25rem]">
                  <Input
                    aria-label={`Course ${index + 1} name`}
                    placeholder={`Course ${index + 1}`}
                    value={course.name}
                    onChange={(e) => updateCourse(course.id, { name: e.target.value })}
                  />
                  <div className="col-span-2 grid grid-cols-2 gap-2 sm:contents">
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="any"
                      aria-label={`Course ${index + 1} credits`}
                      placeholder="Credits"
                      value={course.credits}
                      onChange={(e) => updateCourse(course.id, { credits: e.target.value })}
                      aria-invalid={Boolean(check.error)}
                      className={cn("tabular-nums", check.error && "border-red-400 dark:border-red-700")}
                    />
                    <Select
                      aria-label={`Course ${index + 1} grade`}
                      value={course.grade}
                      onChange={(e) => updateCourse(course.id, { grade: Number(e.target.value) })}
                    >
                      {scale.grades.map((g, i) => (
                        <option key={g.letter} value={i}>
                          {g.letter} ({formatNumber(g.points, 1, scaleId === "4" ? 1 : 0)})
                        </option>
                      ))}
                    </Select>
                  </div>
                  <Button
                    variant="ghost"
                    className="col-start-2 row-start-1 px-2.5 sm:col-start-auto sm:row-start-auto"
                    aria-label={`Remove course ${index + 1}`}
                    disabled={courses.length === 1}
                    onClick={() => setCourses((prev) => prev.filter((c) => c.id !== course.id))}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
                {check.error ? (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                    Course {index + 1}: {check.error}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            disabled={courses.length >= MAX_COURSES}
            onClick={() => setCourses((prev) => [...prev, newCourse()])}
          >
            <Plus aria-hidden />
            Add course
          </Button>
        </Panel>

        <Panel title="Previous results (optional)">
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberField
              id="gpa-previous"
              label="Current CGPA"
              value={previousGpa}
              onChange={setPreviousGpa}
              error={previousGpaCheck.error}
              placeholder={scaleId === "4" ? "3.2" : "7.8"}
              min={0}
              max={scale.max}
            />
            <NumberField
              id="gpa-previous-credits"
              label="Credits completed"
              value={previousCredits}
              onChange={setPreviousCredits}
              error={previousCreditsCheck.error}
              placeholder="60"
              min={0}
            />
          </div>
          <p className="mt-3 text-xs text-muted">Add both to see your new cumulative GPA including this term.</p>
        </Panel>
      </div>

      <div className="space-y-4">
        {gpa !== null ? (
          <>
            <dl className="grid gap-3 sm:grid-cols-2">
              <Stat label={`Term GPA (${scale.label})`} value={formatNumber(gpa, 2, 2)} emphasis />
              <Stat
                label="Cumulative GPA"
                value={cumulative === null ? "Add previous results" : formatNumber(cumulative, 2, 2)}
                emphasis={cumulative !== null}
              />
              <Stat label="Credits this term" value={formatNumber(credits, 2)} />
              <Stat label="Grade points" value={formatNumber(qualityPoints, 2)} />
            </dl>
            <Panel title="How it was calculated">
              <p className="text-sm text-ink">
                GPA = total grade points ÷ total credits = {formatNumber(qualityPoints, 2)} ÷ {formatNumber(credits, 2)} ={" "}
                <strong>{formatNumber(gpa, 2, 2)}</strong>
              </p>
              <p className="mt-2 text-xs text-muted">
                Each course contributes its credits × grade points. Grade point values differ between institutions, so check
                your own grading policy.
              </p>
            </Panel>
          </>
        ) : (
          <EmptyResult>Enter the credits for at least one course.</EmptyResult>
        )}
      </div>
    </ToolColumns>
  );
}
