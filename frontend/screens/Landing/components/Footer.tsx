import React from 'react';

interface FooterProps {
    bookProgress?: number;
}

const Footer: React.FC<FooterProps> = ({ bookProgress = 0 }) => {
    return (
        <footer
            style={{
                position: 'relative',
                padding: '4rem 2rem',
                background: 'linear-gradient(180deg, transparent 0%, #05081A 100%)',
            }}
        >
            {/* Closing Book Animation */}
            <div
                style={{
                    position: 'absolute',
                    top: '-100px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '150px',
                    height: '100px',
                    opacity: 0.5,
                }}
            >
                <div
                    style={{
                        width: '100%',
                        height: '100%',
                        background: 'linear-gradient(135deg, #7C4DFF 0%, #5E35B1 100%)',
                        borderRadius: '8px',
                        boxShadow: '0 10px 40px rgba(124, 77, 255, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <span
                        style={{
                            fontSize: '2rem',
                            color: '#FFCE45',
                            fontWeight: '900',
                            fontFamily: '"Fredoka", system-ui, sans-serif',
                            textShadow: '0 0 20px rgba(255, 206, 69, 0.5)',
                        }}
                    >
                        Talea
                    </span>
                </div>
                {/* Glow effect */}
                <div
                    style={{
                        position: 'absolute',
                        bottom: '-20px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: '80%',
                        height: '20px',
                        background: 'radial-gradient(ellipse at center, rgba(124, 77, 255, 0.4) 0%, transparent 70%)',
                        filter: 'blur(10px)',
                    }}
                />
            </div>

            <div
                style={{
                    maxWidth: '1200px',
                    margin: '0 auto',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '3rem',
                    marginTop: '2rem',
                }}
            >
                {/* Brand */}
                <div>
                    <h3
                        style={{
                            fontSize: '1.8rem',
                            fontWeight: '900',
                            color: '#FFCE45',
                            marginBottom: '1rem',
                            fontFamily: '"Fredoka", "Nunito", system-ui, sans-serif',
                        }}
                    >
                        ✨ Talea
                    </h3>
                    <p
                        style={{
                            color: 'rgba(255,255,255,0.6)',
                            fontSize: '0.95rem',
                            lineHeight: 1.6,
                            fontFamily: '"Nunito", system-ui, sans-serif',
                        }}
                    >
                        Personalisierte Geschichten, die mit deinem Kind mitwachsen.
                    </p>
                </div>

                {/* Links */}
                <div>
                    <h4
                        style={{
                            fontSize: '1rem',
                            fontWeight: '700',
                            color: 'white',
                            marginBottom: '1rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                        }}
                    >
                        Produkt
                    </h4>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        {['Features', 'Preise', 'Demo', 'FAQ'].map((link) => (
                            <li key={link} style={{ marginBottom: '0.5rem' }}>
                                <a
                                    href="#"
                                    style={{
                                        color: 'rgba(255,255,255,0.6)',
                                        textDecoration: 'none',
                                        fontSize: '0.95rem',
                                        transition: 'color 0.2s',
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.color = '#FFCE45')}
                                    onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
                                >
                                    {link}
                                </a>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Company */}
                <div>
                    <h4
                        style={{
                            fontSize: '1rem',
                            fontWeight: '700',
                            color: 'white',
                            marginBottom: '1rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                        }}
                    >
                        Unternehmen
                    </h4>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        {['Über uns', 'Blog', 'Karriere', 'Kontakt'].map((link) => (
                            <li key={link} style={{ marginBottom: '0.5rem' }}>
                                <a
                                    href="#"
                                    style={{
                                        color: 'rgba(255,255,255,0.6)',
                                        textDecoration: 'none',
                                        fontSize: '0.95rem',
                                        transition: 'color 0.2s',
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.color = '#FFCE45')}
                                    onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
                                >
                                    {link}
                                </a>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Legal */}
                <div>
                    <h4
                        style={{
                            fontSize: '1rem',
                            fontWeight: '700',
                            color: 'white',
                            marginBottom: '1rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                        }}
                    >
                        Rechtliches
                    </h4>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        {['Datenschutz', 'Impressum', 'AGB', 'Cookie-Einstellungen'].map((link) => (
                            <li key={link} style={{ marginBottom: '0.5rem' }}>
                                <a
                                    href="#"
                                    style={{
                                        color: 'rgba(255,255,255,0.6)',
                                        textDecoration: 'none',
                                        fontSize: '0.95rem',
                                        transition: 'color 0.2s',
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.color = '#FFCE45')}
                                    onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
                                >
                                    {link}
                                </a>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            {/* Bottom */}
            <div
                style={{
                    maxWidth: '1200px',
                    margin: '3rem auto 0',
                    paddingTop: '2rem',
                    borderTop: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '1rem',
                }}
            >
                <p
                    style={{
                        color: 'rgba(255,255,255,0.4)',
                        fontSize: '0.85rem',
                    }}
                >
                    © 2025 Talea. Made with ❤️ für Kinder & Familien.
                </p>

                {/* Social Links */}
                <div style={{ display: 'flex', gap: '1rem' }}>
                    {['📸', '🐦', '📘', '▶️'].map((icon, i) => (
                        <a
                            key={i}
                            href="#"
                            style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%',
                                background: 'rgba(255,255,255,0.1)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1.2rem',
                                textDecoration: 'none',
                                transition: 'background 0.2s, transform 0.2s',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(124, 77, 255, 0.3)';
                                e.currentTarget.style.transform = 'scale(1.1)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                                e.currentTarget.style.transform = 'scale(1)';
                            }}
                        >
                            {icon}
                        </a>
                    ))}
                </div>
            </div>
        </footer>
    );
};

export default Footer;
