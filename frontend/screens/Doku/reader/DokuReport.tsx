import React, { useId, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  Check,
  Clock,
  Eye,
  FlaskConical,
  MapPin,
  Package,
  RotateCcw,
  ShieldAlert,
  Target,
} from 'lucide-react';

import type { DokuActivityItem, DokuExpert, DokuGuess, DokuKeyFact, DokuSection } from '../../../types/doku';
import { cn } from '../../../lib/utils';
import {
  calculateScore,
  normalizeQuestions,
  useQuizResultSubmit,
  type NormalizedQuestion,
  type QuizDokuMetadata,
} from '../../../components/reader/quizModel';

/*
 * Building blocks of the doku reader in the reportage format: the assignment
 * (Leitfrage), the "Rate mal" guess resolved in the finale, station chapters
 * with their expert, wow cards, the experiment, the Zwischen-Check and the
 * "Das hab ich heute gecheckt" checklist. Older dokus without these fields
 * render as plain chapters with the same cards.
 */

const LETTERS = ['A', 'B', 'C', 'D', 'E'];
const REVEAL = { duration: 0.5, ease: [0.2, 0.65, 0.3, 0.9] as [number, number, number, number] };
const inView = {
  initial: { opacity: 0, y: 14 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.3 },
  transition: REVEAL,
} as const;

export function splitParagraphs(text: string): string[] {
  return String(text || '')
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean);
}

/** The sticker already says "Rate mal!"; the question should not repeat it. */
const stripGuessLabel = (question: string) => question.replace(/^s*rate mal(?: mit)?s*[:!,–-]s*/i, '');

export const ReportAssignment: React.FC<{ question: string }> = ({ question }) => (
  <aside className="rp-assignment" aria-label="Die Leitfrage">
    <p className="rp-assignment-kicker">Die Leitfrage</p>
    <p className="rp-assignment-question">{question}</p>
  </aside>
);

export const GuessCard: React.FC<{ guess: DokuGuess; picked: number | null; onPick: (index: number) => void }> = ({
  guess,
  picked,
  onPick,
}) => {
  const questionId = useId();
  return (
    <motion.section className="rp-guess" aria-labelledby={questionId} {...inView}>
      <span className="rp-sticker" aria-hidden="true">Rate mal!</span>
      <p id={questionId} className="rp-guess-question">{stripGuessLabel(guess.question)}</p>
      <div role="radiogroup" aria-labelledby={questionId} className="rp-guess-options">
        {guess.options.map((option, index) => (
          <button
            key={`${index}-${option}`}
            type="button"
            role="radio"
            aria-checked={picked === index}
            onClick={() => onPick(index)}
            className={cn('rp-guess-opt', picked === index && 'rp-guess-opt--picked')}
          >
            <span className="rp-letter" aria-hidden="true">{LETTERS[index]}</span>
            <span>{option}</span>
          </button>
        ))}
      </div>
      <p className="rp-guess-note" aria-live="polite">
        {picked === null ? 'Wähl deinen Tipp. Ganz am Ende wird aufgelöst.' : 'Dein Tipp steht. Ganz am Ende wird aufgelöst.'}
      </p>
    </motion.section>
  );
};

export const GuessReveal: React.FC<{ guess: DokuGuess; picked: number | null }> = ({ guess, picked }) => {
  const questionId = useId();
  const pickedText = picked === null ? undefined : guess.options[picked];
  const right = picked === guess.answerIndex;
  return (
    <motion.section className="rp-reveal" aria-labelledby={questionId} {...inView}>
      <p className="rp-kicker">Die Auflösung</p>
      <p id={questionId} className="rp-reveal-question">{stripGuessLabel(guess.question)}</p>
      <p className="rp-reveal-answer">
        <span className="rp-letter rp-letter--solid" aria-hidden="true">{LETTERS[guess.answerIndex]}</span>
        {guess.options[guess.answerIndex]}
      </p>
      {guess.reveal && <p className="rp-reveal-text">{guess.reveal}</p>}
      {pickedText !== undefined && (
        <p className={cn('rp-reveal-you', right && 'rp-reveal-you--right')}>
          {right ? 'Du hast richtig getippt!' : `Dein Tipp war „${pickedText}“.`}
        </p>
      )}
    </motion.section>
  );
};

export const RecapChecklist: React.FC<{ points: string[] }> = ({ points }) => {
  const reduceMotion = useReducedMotion();
  const titleId = useId();
  return (
    <motion.section className="rp-recap" aria-labelledby={titleId} {...inView}>
      <span className="rp-stamp" aria-hidden="true">Gecheckt</span>
      <h3 id={titleId} className="rp-recap-title">Das hab ich heute gecheckt</h3>
      <ul className="rp-recap-list">
        {points.map((point, index) => (
          <motion.li
            key={`${index}-${point}`}
            initial={reduceMotion ? false : { opacity: 0, x: -10 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.8 }}
            transition={{ duration: 0.4, delay: 0.15 + index * 0.12 }}
          >
            <span className="rp-box" aria-hidden="true">
              <Check className="h-4 w-4" strokeWidth={3} />
            </span>
            <span>{point}</span>
          </motion.li>
        ))}
      </ul>
    </motion.section>
  );
};

export const TaviLine: React.FC<{ text: string; label?: string }> = ({ text, label = 'Tavi zum Schluss' }) => (
  <motion.figure className="rp-tavi" {...inView}>
    <span className="rp-tavi-mark" aria-hidden="true">T</span>
    <div className="rp-tavi-body">
      <figcaption className="rp-tavi-name">{label}</figcaption>
      <blockquote className="rp-tavi-bubble">{text}</blockquote>
    </div>
  </motion.figure>
);

export const WowList: React.FC<{ facts: DokuKeyFact[] }> = ({ facts }) => (
  <ul className="rp-wow-list">
    {facts.map((fact, index) => (
      <motion.li
        key={`${index}-${fact.fact}`}
        className="rp-wow"
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ ...REVEAL, delay: index * 0.06 }}
      >
        <span className="rp-wow-label">{fact.title || 'Gut zu wissen'}</span>
        <p className="rp-wow-fact">{fact.fact}</p>
        {fact.comparison && <p className="rp-wow-compare">{fact.comparison}</p>}
        {fact.whyItMatters && <p className="rp-wow-note">Warum das zählt: {fact.whyItMatters}</p>}
      </motion.li>
    ))}
  </ul>
);

export const ExperimentCard: React.FC<{ item: DokuActivityItem }> = ({ item }) => {
  const titleId = useId();
  return (
    <motion.article className="rp-lab" aria-labelledby={titleId} {...inView}>
      <header className="rp-lab-head">
        <span className="rp-lab-icon" aria-hidden="true">
          <FlaskConical className="h-5 w-5" />
        </span>
        <div>
          <p className="rp-kicker">Probier's selbst</p>
          <h4 id={titleId} className="rp-lab-title">{item.title}</h4>
        </div>
        {item.durationMinutes != null && (
          <span className="rp-chip">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            {item.durationMinutes} min
          </span>
        )}
      </header>
      {item.description && <p className="rp-lab-desc">{item.description}</p>}
      {item.materials && item.materials.length > 0 && (
        <ul className="rp-materials" aria-label="Das brauchst du">
          {item.materials.map((material, index) => (
            <li key={`${index}-${material}`} className="rp-chip">
              <Package className="h-3.5 w-3.5" aria-hidden="true" />
              {material}
            </li>
          ))}
        </ul>
      )}
      {item.steps && item.steps.length > 0 && (
        <ol className="rp-steps">
          {item.steps.map((step, index) => (
            <li key={`${index}-${step}`}>{step}</li>
          ))}
        </ol>
      )}
      {item.observe && (
        <div className="rp-observe">
          <Eye className="h-4 w-4" aria-hidden="true" />
          <p>
            <strong>Was passiert?</strong> {item.observe}
          </p>
        </div>
      )}
      {item.safetyNote && (
        <div className="rp-warn" role="note">
          <ShieldAlert className="h-4 w-4" aria-hidden="true" />
          <p>{item.safetyNote}</p>
        </div>
      )}
    </motion.article>
  );
};

type QuizContext = {
  avatarId?: string;
  dokuTitle?: string;
  dokuId?: string;
  dokuTopic?: string;
  dokuMetadata?: QuizDokuMetadata;
};

/** Zwischen-Check: one question at a time, check, explanation, next. */
export const CheckQuiz: React.FC<{ section: DokuSection } & QuizContext> = ({ section, ...context }) => {
  const labelId = useId();
  const questions = useMemo<NormalizedQuestion[]>(() => {
    const quiz = section.interactive?.quiz;
    if (!quiz?.enabled || !Array.isArray(quiz.questions)) return [];
    return normalizeQuestions(quiz.questions as unknown[]);
  }, [section.interactive?.quiz]);
  const submitResult = useQuizResultSubmit({ sectionTitle: section.title, questions, ...context });

  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Array<number | null>>(() => Array(questions.length).fill(null));
  const [checked, setChecked] = useState(false);
  const [finished, setFinished] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (questions.length === 0) return null;

  const total = questions.length;
  const current = questions[index];
  const picked = answers[index] ?? null;
  const isLast = index === total - 1;
  const doneCount = finished ? total : index;
  const { correctAnswers, percentage } = calculateScore(questions, answers);

  const pick = (option: number) => {
    if (checked || finished) return;
    setAnswers((previous) => {
      const next = [...previous];
      next[index] = option;
      return next;
    });
  };

  const goOn = async () => {
    if (!checked || submitting) return;
    if (!isLast) {
      setIndex((value) => value + 1);
      setChecked(false);
      return;
    }
    setFinished(true);
    setSubmitting(true);
    try {
      await submitResult(answers);
    } finally {
      setSubmitting(false);
    }
  };

  const restart = () => {
    setIndex(0);
    setAnswers(Array(total).fill(null));
    setChecked(false);
    setFinished(false);
  };

  const verdict =
    percentage >= 80 ? 'Stark gecheckt!' : percentage >= 50 ? 'Gut dabei, fast alles sitzt.' : 'Kein Problem, beim nächsten Mal sitzt es.';

  return (
    <motion.section className="rp-check" aria-labelledby={labelId} {...inView}>
      <div className="rp-check-head">
        <p id={labelId} className="rp-check-label">
          <Target className="h-4 w-4" aria-hidden="true" />
          Zwischen-Check
        </p>
        {!finished && (
          <span className="rp-check-count">
            Frage {index + 1} von {total}
          </span>
        )}
      </div>
      <div className="rp-check-bar" aria-hidden="true">
        {questions.map((question, barIndex) => (
          <span
            key={question.id}
            className={cn(barIndex < doneCount && 'is-done', barIndex === index && !finished && 'is-current')}
          />
        ))}
      </div>

      {finished ? (
        <div className="rp-result" aria-live="polite">
          <p className="rp-result-score">{percentage}%</p>
          <p className="rp-result-text">
            {correctAnswers} von {total} richtig. {verdict}
          </p>
          <button type="button" onClick={restart} className="rp-btn rp-btn--ghost">
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Nochmal checken
          </button>
        </div>
      ) : (
        <>
          <p className="rp-check-q">{current.question}</p>
          <div className="rp-check-opts">
            {current.options.map((option, optionIndex) => {
              const isPicked = picked === optionIndex;
              const isRight = checked && optionIndex === current.answerIndex;
              const isWrong = checked && isPicked && !isRight;
              return (
                <button
                  key={`${index}-${optionIndex}`}
                  type="button"
                  onClick={() => pick(optionIndex)}
                  disabled={checked}
                  aria-pressed={isPicked}
                  className={cn(
                    'rp-opt',
                    isPicked && !checked && 'rp-opt--picked',
                    isRight && 'rp-opt--right',
                    isWrong && 'rp-opt--wrong',
                    checked && !isRight && !isWrong && 'rp-opt--dim',
                  )}
                >
                  <span className="rp-letter" aria-hidden="true">{LETTERS[optionIndex]}</span>
                  <span>{option}</span>
                </button>
              );
            })}
          </div>
          <div aria-live="polite">
            {checked && (
              <p className="rp-check-explain">
                <strong>{picked === current.answerIndex ? 'Genau!' : `Nicht ganz – richtig ist ${LETTERS[current.answerIndex]}.`}</strong>
                {current.explanation}
              </p>
            )}
          </div>
          <div className="rp-check-actions">
            {checked ? (
              <button type="button" className="rp-btn rp-btn--ink" onClick={goOn} disabled={submitting}>
                {isLast ? 'Check abschließen' : 'Nächste Frage'}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : (
              <button type="button" className="rp-btn rp-btn--ink" onClick={() => setChecked(true)} disabled={picked === null}>
                Antwort prüfen
              </button>
            )}
          </div>
        </>
      )}
    </motion.section>
  );
};

const ExpertBadge: React.FC<{ expert: DokuExpert }> = ({ expert }) => (
  <p className="rp-expert">
    <span className="rp-expert-mark" aria-hidden="true">
      {(expert.name || expert.role).trim().charAt(0).toUpperCase()}
    </span>
    <span className="rp-expert-text">
      <span className="rp-expert-label">Fachperson</span>
      {[expert.role, expert.name].filter(Boolean).join(' ')}
    </span>
  </p>
);

export const ReportChapter: React.FC<{
  section: DokuSection;
  index: number;
  total: number;
  quiz: QuizContext;
  onOpenImage: (src: string, alt: string) => void;
  registerElement: (index: number, element: HTMLElement | null) => void;
}> = ({ section, index, total, quiz, onOpenImage, registerElement }) => {
  const paragraphs = useMemo(() => splitParagraphs(section.content), [section.content]);
  const [imageFailed, setImageFailed] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const isWissen = section.kind === 'wissen';
  const isStation = !isWissen && (section.kind === 'station' || Boolean(section.place));
  const kicker = isWissen ? 'Check-Wissen' : isStation ? `Station ${index + 1}` : `Kapitel ${index + 1} von ${total}`;
  const facts = section.keyFacts ?? [];
  const experiments = section.interactive?.activities?.enabled ? section.interactive.activities.items ?? [] : [];
  const imageAlt = `${section.title} – Bild`;

  return (
    <section
      id={`section-${index}`}
      ref={(element) => registerElement(index, element)}
      className={cn('rp-chapter', isWissen && 'rp-chapter--wissen')}
      aria-labelledby={`section-${index}-title`}
    >
      <motion.header className="rp-chapter-head" {...inView}>
        <div className="rp-kicker-row">
          <span className="rp-pill">{kicker}</span>
          {section.place && (
            <span className="rp-place">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              {section.place}
            </span>
          )}
        </div>
        <h2 id={`section-${index}-title`} className="rp-chapter-title">
          {section.title}
        </h2>
        {section.expert && <ExpertBadge expert={section.expert} />}
      </motion.header>

      {section.miniQuestion && (
        <p className="rp-miniq">
          <span className="rp-miniq-mark" aria-hidden="true">?</span>
          <span>
            <span className="rp-visually-hidden">Frage dieses Kapitels: </span>
            {section.miniQuestion}
          </span>
        </p>
      )}

      {section.imageUrl && !imageFailed && (
        <motion.figure className="rp-figure" {...inView}>
          <button
            type="button"
            className="rp-figure-btn"
            onClick={() => onOpenImage(section.imageUrl!, imageAlt)}
            aria-label={`${imageAlt} – vergrößern`}
          >
            <img
              src={section.imageUrl}
              alt=""
              className={cn('rp-figure-img', imageLoaded && 'rp-figure-img--loaded')}
              loading={index === 0 ? 'eager' : 'lazy'}
              decoding="async"
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageFailed(true)}
            />
          </button>
        </motion.figure>
      )}

      <div className="rp-prose">
        {paragraphs.map((paragraph, paragraphIndex) => (
          <p
            key={paragraphIndex}
            className="rp-paragraph"
          >
            {paragraph}
          </p>
        ))}
      </div>

      {facts.length > 0 && <WowList facts={facts} />}
      {experiments.map((item, itemIndex) => (
        <ExperimentCard key={`${itemIndex}-${item.title}`} item={item} />
      ))}
      <CheckQuiz section={section} {...quiz} />
    </section>
  );
};
