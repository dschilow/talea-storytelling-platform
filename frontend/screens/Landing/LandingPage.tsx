import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { colors } from '../../utils/constants/colors';
import { Sparkles, BookOpen, Users, GraduationCap, ArrowRight } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const LandingPage = () => {
    const navigate = useNavigate();
    const sectionsRef = useRef<(HTMLDivElement | null)[]>([]);

    useEffect(() => {
        // Smooth scroll animations for each section
        sectionsRef.current.forEach((section, index) => {
            if (section) {
                gsap.fromTo(
                    section,
                    {
                        opacity: 0,
                        y: 100,
                    },
                    {
                        opacity: 1,
                        y: 0,
                        duration: 1.2,
                        ease: 'power3.out',
                        scrollTrigger: {
                            trigger: section,
                            start: 'top 80%',
                            end: 'top 20%',
                            toggleActions: 'play none none reverse',
                        },
                    }
                );

                // Parallax effect for images
                const img = section.querySelector('.landing-image');
                if (img) {
                    gsap.to(img, {
                        y: -50,
                        ease: 'none',
                        scrollTrigger: {
                            trigger: section,
                            start: 'top bottom',
                            end: 'bottom top',
                            scrub: true,
                        },
                    });
                }
            }
        });

        return () => {
            ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
        };
    }, []);

    const addToRefs = (el: HTMLDivElement | null) => {
        if (el && !sectionsRef.current.includes(el)) {
            sectionsRef.current.push(el);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
            fontFamily: '"Fredoka", "Nunito", system-ui, sans-serif',
            overflow: 'hidden',
        }}>
            {/* Hero Section */}
            <section
                ref={addToRefs}
                style={{
                    position: 'relative',
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    background: `url(/landing-assets/hero.png) center/cover`,
                }}
            >
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(180deg, rgba(26, 26, 46, 0.7) 0%, rgba(26, 26, 46, 0.9) 100%)',
                }} />

                <div style={{
                    position: 'relative',
                    zIndex: 1,
                    textAlign: 'center',
                    padding: '2rem',
                    maxWidth: '1200px',
                }}>
                    <div style={{
                        fontSize: '80px',
                        marginBottom: '1rem',
                        animation: 'float 3s ease-in-out infinite',
                    }}>✨</div>

                    <h1 style={{
                        fontSize: 'clamp(3rem, 8vw, 6rem)',
                        fontWeight: '900',
                        background: 'linear-gradient(135deg, #a989f2 0%, #f093fb 50%, #4facfe 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        marginBottom: '1.5rem',
                        lineHeight: 1.1,
                    }}>
                        Von Idee bis Fertig.
                    </h1>

                    <p style={{
                        fontSize: 'clamp(1.2rem, 3vw, 1.8rem)',
                        color: colors.text.primary,
                        marginBottom: '3rem',
                        maxWidth: '800px',
                        margin: '0 auto 3rem',
                        lineHeight: 1.6,
                    }}>
                        Tauche ein in eine magische Märchenwelt, wo KI-Avatare mit einzigartigen Persönlichkeiten personalisierte Geschichten und Dokus erschaffen
                    </p>

                    <button
                        onClick={() => navigate('/story')}
                        style={{
                            background: 'linear-gradient(135deg, #a989f2 0%, #f093fb 100%)',
                            border: 'none',
                            padding: '1.5rem 3rem',
                            fontSize: '1.3rem',
                            fontWeight: '700',
                            color: 'white',
                            borderRadius: '50px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '1rem',
                            transition: 'all 0.3s ease',
                            boxShadow: '0 20px 40px rgba(169, 137, 242, 0.4)',
                            fontFamily: '"Fredoka", "Nunito", system-ui, sans-serif',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-5px) scale(1.05)';
                            e.currentTarget.style.boxShadow = '0 25px 50px rgba(169, 137, 242, 0.6)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0) scale(1)';
                            e.currentTarget.style.boxShadow = '0 20px 40px rgba(169, 137, 242, 0.4)';
                        }}
                    >
                        Beginne dein Abenteuer
                        <ArrowRight size={24} />
                    </button>
                </div>

                <style>{`
          @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-20px); }
          }
        `}</style>
            </section>

            {/* Section 1: Die Idee */}
            <section
                ref={addToRefs}
                style={{
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '4rem 2rem',
                    background: 'linear-gradient(180deg, #1a1a2e 0%, #0f3460 100%)',
                }}
            >
                <div style={{
                    maxWidth: '1400px',
                    margin: '0 auto',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
                    gap: '4rem',
                    alignItems: 'center',
                }}>
                    <div>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1rem',
                            marginBottom: '1rem',
                            color: colors.lavender[400],
                        }}>
                            <Sparkles size={32} />
                            <span style={{ fontSize: '1.3rem', fontWeight: '700' }}>1</span>
                        </div>

                        <h2 style={{
                            fontSize: 'clamp(2.5rem, 5vw, 4rem)',
                            fontWeight: '900',
                            color: colors.text.primary,
                            marginBottom: '2rem',
                            lineHeight: 1.2,
                        }}>
                            Die Idee
                        </h2>

                        <p style={{
                            fontSize: '1.3rem',
                            color: colors.text.secondary,
                            lineHeight: 1.8,
                            marginBottom: '1.5rem',
                        }}>
                            Talea ist eine magische Plattform, die die Kraft der KI nutzt, um einzigartige, personalisierte Geschichten und Dokumentationen zu erschaffen.
                        </p>

                        <p style={{
                            fontSize: '1.3rem',
                            color: colors.text.secondary,
                            lineHeight: 1.8,
                        }}>
                            Jede Geschichte ist wie ein Märchen – speziell für dich kreiert, mit Charakteren, die sich weiterentwickeln und aus jeder Interaktion lernen.
                        </p>
                    </div>

                    <div style={{
                        borderRadius: '30px',
                        overflow: 'hidden',
                        boxShadow: '0 30px 60px rgba(0, 0, 0, 0.5)',
                    }}>
                        <img
                            src="/landing-assets/idea.png"
                            alt="Talea Idee"
                            className="landing-image"
                            style={{
                                width: '100%',
                                height: 'auto',
                                display: 'block',
                            }}
                        />
                    </div>
                </div>
            </section>

            {/* Section 2: Avatare */}
            <section
                ref={addToRefs}
                style={{
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '4rem 2rem',
                    background: 'linear-gradient(180deg, #0f3460 0%, #1a1a2e 100%)',
                }}
            >
                <div style={{
                    maxWidth: '1400px',
                    margin: '0 auto',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
                    gap: '4rem',
                    alignItems: 'center',
                }}>
                    <div style={{
                        borderRadius: '30px',
                        overflow: 'hidden',
                        boxShadow: '0 30px 60px rgba(0, 0, 0, 0.5)',
                        order: 2,
                    }}>
                        <img
                            src="/landing-assets/avatars.png"
                            alt="Talea Avatare"
                            className="landing-image"
                            style={{
                                width: '100%',
                                height: 'auto',
                                display: 'block',
                                background: 'white',
                            }}
                        />
                    </div>

                    <div style={{ order: 1 }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1rem',
                            marginBottom: '1rem',
                            color: colors.lavender[400],
                        }}>
                            <Users size={32} />
                            <span style={{ fontSize: '1.3rem', fontWeight: '700' }}>2</span>
                        </div>

                        <h2 style={{
                            fontSize: 'clamp(2.5rem, 5vw, 4rem)',
                            fontWeight: '900',
                            color: colors.text.primary,
                            marginBottom: '2rem',
                            lineHeight: 1.2,
                        }}>
                            Avatare
                        </h2>

                        <p style={{
                            fontSize: '1.3rem',
                            color: colors.text.secondary,
                            lineHeight: 1.8,
                            marginBottom: '1.5rem',
                        }}>
                            Erschaffe deine eigenen magischen Avatare mit einzigartigen Persönlichkeiten, Fähigkeiten und Geschichten.
                        </p>

                        <p style={{
                            fontSize: '1.3rem',
                            color: colors.text.secondary,
                            lineHeight: 1.8,
                            marginBottom: '1.5rem',
                        }}>
                            Jeder Avatar entwickelt sich weiter, sammelt Erfahrungen und baut eine tiefe Beziehung zu dir auf.
                        </p>

                        <button
                            onClick={() => navigate('/avatar/create')}
                            style={{
                                background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                                border: 'none',
                                padding: '1rem 2rem',
                                fontSize: '1.1rem',
                                fontWeight: '700',
                                color: 'white',
                                borderRadius: '50px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                transition: 'all 0.3s ease',
                                fontFamily: '"Fredoka", "Nunito", system-ui, sans-serif',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-3px)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                            }}
                        >
                            Avatar erstellen
                            <ArrowRight size={20} />
                        </button>
                    </div>
                </div>
            </section>

            {/* Section 3: Geschichten */}
            <section
                ref={addToRefs}
                style={{
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '4rem 2rem',
                    background: 'linear-gradient(180deg, #1a1a2e 0%, #0f3460 100%)',
                }}
            >
                <div style={{
                    maxWidth: '1400px',
                    margin: '0 auto',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
                    gap: '4rem',
                    alignItems: 'center',
                }}>
                    <div>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1rem',
                            marginBottom: '1rem',
                            color: colors.lavender[400],
                        }}>
                            <BookOpen size={32} />
                            <span style={{ fontSize: '1.3rem', fontWeight: '700' }}>3</span>
                        </div>

                        <h2 style={{
                            fontSize: 'clamp(2.5rem, 5vw, 4rem)',
                            fontWeight: '900',
                            color: colors.text.primary,
                            marginBottom: '2rem',
                            lineHeight: 1.2,
                        }}>
                            Geschichten
                        </h2>

                        <p style={{
                            fontSize: '1.3rem',
                            color: colors.text.secondary,
                            lineHeight: 1.8,
                            marginBottom: '1.5rem',
                        }}>
                            Erlebe personalisierte Märchen und Abenteuer, die speziell für dich und deine Avatare kreiert werden.
                        </p>

                        <p style={{
                            fontSize: '1.3rem',
                            color: colors.text.secondary,
                            lineHeight: 1.8,
                            marginBottom: '1.5rem',
                        }}>
                            Jede Geschichte ist einzigartig, mit wunderschönen Illustrationen und spannenden Wendungen, die dich in magische Welten entführen.
                        </p>

                        <button
                            onClick={() => navigate('/story')}
                            style={{
                                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                                border: 'none',
                                padding: '1rem 2rem',
                                fontSize: '1.1rem',
                                fontWeight: '700',
                                color: 'white',
                                borderRadius: '50px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                transition: 'all 0.3s ease',
                                fontFamily: '"Fredoka", "Nunito", system-ui, sans-serif',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-3px)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                            }}
                        >
                            Geschichte erstellen
                            <ArrowRight size={20} />
                        </button>
                    </div>

                    <div style={{
                        borderRadius: '30px',
                        overflow: 'hidden',
                        boxShadow: '0 30px 60px rgba(0, 0, 0, 0.5)',
                    }}>
                        <img
                            src="/landing-assets/stories.png"
                            alt="Talea Geschichten"
                            className="landing-image"
                            style={{
                                width: '100%',
                                height: 'auto',
                                display: 'block',
                            }}
                        />
                    </div>
                </div>
            </section>

            {/* Section 4: Dokus */}
            <section
                ref={addToRefs}
                style={{
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '4rem 2rem',
                    background: 'linear-gradient(180deg, #0f3460 0%, #1a1a2e 100%)',
                }}
            >
                <div style={{
                    maxWidth: '1400px',
                    margin: '0 auto',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
                    gap: '4rem',
                    alignItems: 'center',
                }}>
                    <div style={{
                        borderRadius: '30px',
                        overflow: 'hidden',
                        boxShadow: '0 30px 60px rgba(0, 0, 0, 0.5)',
                        order: 2,
                        height: '600px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    }}>
                        <div style={{
                            fontSize: '120px',
                            animation: 'float 3s ease-in-out infinite',
                        }}>🦉</div>
                    </div>

                    <div style={{ order: 1 }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1rem',
                            marginBottom: '1rem',
                            color: colors.lavender[400],
                        }}>
                            <GraduationCap size={32} />
                            <span style={{ fontSize: '1.3rem', fontWeight: '700' }}>4</span>
                        </div>

                        <h2 style={{
                            fontSize: 'clamp(2.5rem, 5vw, 4rem)',
                            fontWeight: '900',
                            color: colors.text.primary,
                            marginBottom: '2rem',
                            lineHeight: 1.2,
                        }}>
                            Dokus
                        </h2>

                        <p style={{
                            fontSize: '1.3rem',
                            color: colors.text.secondary,
                            lineHeight: 1.8,
                            marginBottom: '1.5rem',
                        }}>
                            Lerne auf spielerische Weise mit interaktiven Dokumentationen, die komplexe Themen kindgerecht und unterhaltsam erklären.
                        </p>

                        <p style={{
                            fontSize: '1.3rem',
                            color: colors.text.secondary,
                            lineHeight: 1.8,
                            marginBottom: '1.5rem',
                        }}>
                            Von Wissenschaft bis Geschichte – jede Doku wird von deinen Avataren erzählt und macht Lernen zu einem magischen Abenteuer.
                        </p>

                        <button
                            onClick={() => navigate('/doku/create')}
                            style={{
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                border: 'none',
                                padding: '1rem 2rem',
                                fontSize: '1.1rem',
                                fontWeight: '700',
                                color: 'white',
                                borderRadius: '50px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                transition: 'all 0.3s ease',
                                fontFamily: '"Fredoka", "Nunito", system-ui, sans-serif',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-3px)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                            }}
                        >
                            Doku erstellen
                            <ArrowRight size={20} />
                        </button>
                    </div>
                </div>
            </section>

            {/* Final CTA Section */}
            <section
                ref={addToRefs}
                style={{
                    minHeight: '80vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '4rem 2rem',
                    background: 'linear-gradient(180deg, #1a1a2e 0%, #0f3460 100%)',
                    textAlign: 'center',
                }}
            >
                <div style={{ maxWidth: '900px' }}>
                    <div style={{
                        fontSize: '100px',
                        marginBottom: '2rem',
                        animation: 'float 3s ease-in-out infinite',
                    }}>🌟</div>

                    <h2 style={{
                        fontSize: 'clamp(2.5rem, 6vw, 5rem)',
                        fontWeight: '900',
                        background: 'linear-gradient(135deg, #a989f2 0%, #f093fb 50%, #4facfe 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        marginBottom: '2rem',
                        lineHeight: 1.2,
                    }}>
                        Bereit für dein<br />magisches Abenteuer?
                    </h2>

                    <p style={{
                        fontSize: '1.5rem',
                        color: colors.text.secondary,
                        marginBottom: '3rem',
                        lineHeight: 1.8,
                    }}>
                        Tauche ein in eine Welt voller Fantasie, Lernen und unvergesslicher Geschichten.
                    </p>

                    <div style={{
                        display: 'flex',
                        gap: '1.5rem',
                        justifyContent: 'center',
                        flexWrap: 'wrap',
                    }}>
                        <button
                            onClick={() => navigate('/story')}
                            style={{
                                background: 'linear-gradient(135deg, #a989f2 0%, #f093fb 100%)',
                                border: 'none',
                                padding: '1.5rem 3rem',
                                fontSize: '1.3rem',
                                fontWeight: '700',
                                color: 'white',
                                borderRadius: '50px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '1rem',
                                transition: 'all 0.3s ease',
                                boxShadow: '0 20px 40px rgba(169, 137, 242, 0.4)',
                                fontFamily: '"Fredoka", "Nunito", system-ui, sans-serif',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-5px) scale(1.05)';
                                e.currentTarget.style.boxShadow = '0 25px 50px rgba(169, 137, 242, 0.6)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                                e.currentTarget.style.boxShadow = '0 20px 40px rgba(169, 137, 242, 0.4)';
                            }}
                        >
                            Jetzt starten
                            <ArrowRight size={24} />
                        </button>

                        <button
                            onClick={() => navigate('/avatar')}
                            style={{
                                background: 'transparent',
                                border: '2px solid #a989f2',
                                padding: '1.5rem 3rem',
                                fontSize: '1.3rem',
                                fontWeight: '700',
                                color: '#a989f2',
                                borderRadius: '50px',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                fontFamily: '"Fredoka", "Nunito", system-ui, sans-serif',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(169, 137, 242, 0.1)';
                                e.currentTarget.style.transform = 'translateY(-3px)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.transform = 'translateY(0)';
                            }}
                        >
                            Avatare ansehen
                        </button>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default LandingPage;
