import React, { useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import AuthModal from './AuthModal';
import {
    ArrowRight,
    CheckCircle2,
    Zap,
    Cpu,
    Layout,
    Users,
    Play,
    BarChart,
    ShieldCheck,
    Code,
    Terminal,
    Globe,
    Database,
    Lock,
    MessageSquare,
    HelpCircle,
    FileText
} from 'lucide-react';

const LandingPage = ({ onEnter, onLogin: onLoginProp }) => {
    const { user } = useAuth();
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [authMode, setAuthMode] = useState('signin');

    const onLogin = () => {
        if (user) {
            // Already logged in, go to dashboard
            if (onEnter) onEnter();
            if (onLoginProp) onLoginProp();
        } else {
            // Show auth modal
            setAuthMode('signin');
            setShowAuthModal(true);
        }
    };

    const onSignUp = () => {
        setAuthMode('signup');
        setShowAuthModal(true);
    };

    const scrollToSection = (id) => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <div className="landing-container" style={{
            zIndex: 100,
            background: 'var(--bg-void)',
            color: 'var(--lux-primary)',
            overflowY: 'auto',
            fontFamily: 'var(--font-sans)',
            position: 'absolute', inset: 0
        }}>
            {/* Background Atmosphere */}
            <div className="void-atmosphere"></div>

            {/* Navigation */}
            <nav style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '2rem 4rem',
                maxWidth: '1400px',
                margin: '0 auto',
                backdropFilter: 'blur(10px)',
                position: 'sticky', top: 0, zIndex: 50
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '1.2rem' }}>
                    <Zap size={24} style={{ color: 'var(--accent-cyan)', filter: 'drop-shadow(0 0 8px rgba(0,240,255,0.5))' }} fill="currentColor" />
                    <span>TeamPilot</span>
                </div>

                <div style={{ display: 'flex', gap: '3rem', fontSize: '0.9rem', color: 'var(--lux-tertiary)' }}>
                    <span onClick={() => scrollToSection('product')} style={{ cursor: 'pointer', color: 'var(--lux-primary)' }}>Product</span>
                    <span onClick={() => scrollToSection('solutions')} style={{ cursor: 'pointer', transition: 'color 0.2s' }} onMouseOver={e => e.target.style.color = 'var(--lux-primary)'} onMouseOut={e => e.target.style.color = 'var(--lux-tertiary)'}>Solutions</span>
                    <span onClick={() => scrollToSection('pricing')} style={{ cursor: 'pointer', transition: 'color 0.2s' }} onMouseOver={e => e.target.style.color = 'var(--lux-primary)'} onMouseOut={e => e.target.style.color = 'var(--lux-tertiary)'}>Pricing</span>
                    <span onClick={() => scrollToSection('developers')} style={{ cursor: 'pointer', transition: 'color 0.2s' }} onMouseOver={e => e.target.style.color = 'var(--lux-primary)'} onMouseOut={e => e.target.style.color = 'var(--lux-tertiary)'}>Developers</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                    <span onClick={() => scrollToSection('faq')} style={{ fontSize: '0.9rem', cursor: 'pointer', color: 'var(--lux-tertiary)' }}>FAQ</span>
                    <button
                        onClick={onLogin}
                        className="hud-btn primary"
                        style={{
                            borderRadius: '99px',
                            fontWeight: 600,
                            padding: '0.75rem 1.5rem',
                            color: '#000'
                        }}
                    >
                        Get It Now
                    </button>
                </div>
            </nav>

            {/* Hero Section */}
            <section style={{
                maxWidth: '1400px',
                margin: '0 auto',
                padding: '4rem 4rem 2rem',
                display: 'grid',
                gridTemplateColumns: '4fr 6fr',
                gap: '4rem',
                alignItems: 'center',
                minHeight: '80vh'
            }}>
                {/* Left Content */}
                <div className="animate-slide-up">
                    <h1 style={{
                        fontSize: '6rem',
                        fontWeight: 500,
                        lineHeight: 1,
                        letterSpacing: '-0.03em',
                        marginBottom: '4rem',
                        textShadow: '0 0 40px rgba(255,255,255,0.1)'
                    }}>
                        Plan.<br />
                        Trigger<br />
                        Relax
                    </h1>

                    <div className="animate-slide-up delay-100" style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                        <span style={{ fontSize: '1.5rem', fontFamily: 'serif', fontStyle: 'italic', color: 'var(--lux-tertiary)' }}>/</span>
                        <div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 500 }}>Automation Workflow</div>
                            <div style={{ fontSize: '1.2rem', color: 'var(--lux-secondary)' }}>Solution Provider.</div>
                        </div>

                        <button
                            onClick={onLogin}
                            className="hud-btn"
                            style={{
                                background: 'var(--lux-primary)',
                                color: '#000',
                                borderRadius: '99px',
                                fontSize: '1rem',
                                padding: '0.75rem 1.5rem',
                                marginLeft: '2rem',
                                fontWeight: 600
                            }}
                        >
                            Start <ArrowRight size={18} />
                        </button>
                    </div>
                </div>

                {/* Right Visual (Flow Chart Card) */}
                <div className="animate-scale-in delay-200" style={{
                    background: 'linear-gradient(135deg, rgba(217,249,157,0.1) 0%, rgba(167,243,208,0.05) 100%)',
                    borderRadius: '40px',
                    padding: '3rem',
                    position: 'relative',
                    height: '600px',
                    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                    overflow: 'hidden',
                    border: '1px solid var(--glass-border)',
                    backdropFilter: 'blur(20px)'
                }}>
                    {/* Mock Flow Interface */}
                    <div style={{
                        position: 'absolute',
                        top: '50%', left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '90%',
                        height: '70%',
                        background: 'rgba(0,0,0,0.4)',
                        backdropFilter: 'blur(20px)',
                        borderRadius: '24px',
                        border: '1px solid var(--glass-border)',
                        padding: '2rem'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
                            <div style={{ background: 'var(--glass-surface)', padding: '0.5rem 1rem', borderRadius: '12px', fontWeight: 600, fontSize: '0.9rem', color: 'var(--lux-primary)' }}>ACME Campaign Setup</div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <div style={{ width: 10, height: 10, background: 'var(--accent-cyan)', borderRadius: '50%', boxShadow: '0 0 10px var(--accent-cyan)' }}></div>
                                <div style={{ width: 10, height: 10, border: '1px solid var(--lux-tertiary)', borderRadius: '50%' }}></div>
                            </div>
                        </div>

                        {/* Flow Nodes */}
                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '4rem' }}>
                            <div className="flow-node" style={{ background: 'var(--glass-surface)', padding: '1rem', borderRadius: '16px', width: '140px', border: '1px solid var(--glass-border)' }}>
                                <div style={{ fontSize: '0.7rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--lux-primary)' }}>Trigger Request</div>
                                <div style={{ fontSize: '0.6rem', background: 'rgba(0,255,157,0.1)', color: 'var(--accent-success)', padding: '0.2rem 0.4rem', borderRadius: '4px', display: 'inline-block' }}>Active</div>
                            </div>
                            <div className="flow-node" style={{ background: 'var(--glass-surface)', padding: '1rem', borderRadius: '16px', width: '140px', border: '1px solid var(--glass-border)' }}>
                                <div style={{ fontSize: '0.7rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--lux-primary)' }}>Work Assignment</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <div style={{ width: 16, height: 16, background: 'var(--lux-secondary)', borderRadius: '50%' }}></div>
                                    <span style={{ fontSize: '0.6rem', color: 'var(--lux-secondary)' }}>Sales Team</span>
                                </div>
                            </div>
                            <div className="flow-node" style={{ background: 'var(--glass-surface)', padding: '1rem', borderRadius: '16px', width: '140px', border: '1px solid var(--glass-border)' }}>
                                <div style={{ fontSize: '0.7rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--lux-primary)' }}>Process Started</div>
                                <div style={{ fontSize: '0.6rem', color: 'var(--lux-tertiary)' }}>Converted Lead 4X</div>
                            </div>
                        </div>
                    </div>

                    {/* Decorative Elements */}
                    <Zap size={48} style={{ position: 'absolute', top: '10%', left: '10%', opacity: 0.5, color: 'var(--accent-cyan)' }} />
                    <Cpu size={32} style={{ position: 'absolute', bottom: '15%', right: '10%', color: 'var(--lux-secondary)' }} />
                </div>
            </section>

            {/* Social Proof */}
            <section style={{
                padding: '2rem 0',
                borderTop: '1px solid var(--glass-border)',
                borderBottom: '1px solid var(--glass-border)',
                marginTop: '2rem',
                background: 'rgba(255,255,255,0.01)'
            }}>
                <div style={{
                    maxWidth: '1200px',
                    margin: '0 auto',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    opacity: 0.5,
                    filter: 'grayscale(100%)'
                }}>
                    <span style={{ fontWeight: 700, fontSize: '1.5rem', color: 'var(--lux-primary)' }}>Rakuten</span>
                    <span style={{ fontWeight: 700, fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--lux-primary)' }}><div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid currentColor' }}></div> NCR</span>
                    <span style={{ fontWeight: 700, fontSize: '1.5rem', color: 'var(--lux-primary)' }}>monday<span style={{ fontWeight: 400 }}>.com</span></span>
                    <span style={{ fontWeight: 700, fontSize: '1.5rem', fontFamily: 'serif', color: 'var(--lux-primary)' }}>Disney</span>
                    <span style={{ fontWeight: 700, fontSize: '1.5rem', color: 'var(--lux-primary)' }}>Dropbox</span>
                </div>
            </section>

            {/* Product Section */}
            <section id="product" style={{
                maxWidth: '1200px',
                margin: '8rem auto',
                padding: '0 2rem'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '6rem' }}>
                    <h2 style={{ fontSize: '3rem', fontWeight: 500, marginBottom: '1.5rem' }}>Powering the next generation<br />of automated workflows.</h2>
                    <p style={{ color: 'var(--lux-secondary)', fontSize: '1.2rem', maxWidth: '600px', margin: '0 auto' }}>
                        Everything you need to build, deploy, and scale your automation infrastructure without the headache.
                    </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem' }}>
                    {[
                        { icon: <Layout size={32} />, title: 'Visual Builder', desc: 'Drag and drop interface to design complex workflows in minutes, not days.' },
                        { icon: <Zap size={32} />, title: 'Instant Triggers', desc: 'Real-time event processing with sub-millisecond latency for critical tasks.' },
                        { icon: <ShieldCheck size={32} />, title: 'Enterprise Security', desc: 'SOC2 compliant infrastructure with role-based access control built-in.' }
                    ].map((feature, i) => (
                        <div key={i} className="widget animate-slide-up" style={{
                            padding: '2rem',
                            animationDelay: `${i * 100}ms`
                        }}>
                            <div style={{
                                width: 60, height: 60, borderRadius: '16px',
                                background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                marginBottom: '1.5rem', color: 'var(--accent-cyan)'
                            }}>
                                {feature.icon}
                            </div>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 500, marginBottom: '1rem', color: 'var(--lux-primary)' }}>{feature.title}</h3>
                            <p style={{ color: 'var(--lux-secondary)', lineHeight: 1.6 }}>{feature.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Solutions Section */}
            <section id="solutions" style={{
                background: 'rgba(0,0,0,0.3)',
                padding: '8rem 2rem',
                borderTop: '1px solid var(--glass-border)',
                borderBottom: '1px solid var(--glass-border)'
            }}>
                <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6rem', alignItems: 'center' }}>
                    <div>
                        <div style={{ color: 'var(--accent-cyan)', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Globe size={18} /> SOLUTIONS
                        </div>
                        <h2 style={{ fontSize: '3.5rem', fontWeight: 500, lineHeight: 1.1, marginBottom: '2rem' }}>
                            Designed for<br />Modern Teams
                        </h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                            {[
                                { title: 'For Marketing Agencies', desc: 'Automate lead generation and client reporting. Save 20+ hours per week.' },
                                { title: 'For Sales Teams', desc: 'Enrich leads automatically and sync with your CRM in real-time.' },
                                { title: 'For Developers', desc: 'Build custom scrapers and API connectors with full code control.' }
                            ].map((item, i) => (
                                <div key={i} style={{ paddingLeft: '2rem', borderLeft: '2px solid var(--glass-border)' }}>
                                    <h4 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '0.5rem' }}>{item.title}</h4>
                                    <p style={{ color: 'var(--lux-secondary)' }}>{item.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div style={{
                        background: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.1) 0%, rgba(0,0,0,0) 100%)',
                        borderRadius: '32px',
                        padding: '3rem',
                        height: '500px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                        overflow: 'hidden',
                        border: '1px solid var(--glass-border)'
                    }}>
                        <div style={{
                            position: 'absolute', inset: 0,
                            backgroundImage: 'radial-gradient(rgba(255,255,255,0.1) 1px, transparent 1px)',
                            backgroundSize: '20px 20px',
                            opacity: 0.2
                        }}></div>
                        <div style={{ position: 'relative', textAlign: 'center' }}>
                            {/* Placeholder for solution visual */}
                            <div style={{
                                width: '300px', height: '200px', background: 'rgba(0,0,0,0.5)', borderRadius: '12px', border: '1px solid var(--glass-border)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem',
                                backdropFilter: 'blur(10px)'
                            }}>
                                <BarChart size={48} color="var(--lux-tertiary)" />
                                <div style={{ fontSize: '0.9rem', color: 'var(--lux-secondary)' }}>Analytics Dashboard</div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Growth Stat Section */}
            <section style={{
                maxWidth: '1200px',
                margin: '6rem auto',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '4rem',
                alignItems: 'center'
            }}>
                <div>
                    <div style={{ fontSize: '12rem', fontWeight: 500, lineHeight: 1, textShadow: '0 0 40px rgba(255,255,255,0.1)' }}>5X</div>
                    <p style={{ fontSize: '1.5rem', color: 'var(--lux-secondary)', marginTop: '1rem' }}>
                        40% Agency Adopted<br />The Product.
                    </p>
                </div>

                <div style={{ borderLeft: '1px solid var(--glass-border)', paddingLeft: '4rem' }}>
                    <h3 style={{ fontSize: '2rem', fontWeight: 500, marginBottom: '1.5rem' }}>Growth Hack</h3>
                    <p style={{ fontSize: '1.1rem', color: 'var(--lux-secondary)', lineHeight: 1.6, marginBottom: '3rem' }}>
                        Quickly transforms millions of your data points into insights your team can act on immediately. From scraping to analysis, automation is just one click away.
                    </p>
                    <button
                        onClick={onLogin}
                        className="hud-btn primary"
                        style={{
                            borderRadius: '99px',
                            fontWeight: 600,
                            padding: '1rem 2rem',
                            color: '#000'
                        }}
                    >
                        Begin Now <ArrowRight size={18} />
                    </button>
                </div>
            </section>

            {/* Pricing Section */}
            <section id="pricing" style={{
                maxWidth: '1200px',
                margin: '8rem auto',
                padding: '0 2rem'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '6rem' }}>
                    <h2 style={{ fontSize: '3rem', fontWeight: 500, marginBottom: '1.5rem' }}>Simple, transparent pricing.</h2>
                    <p style={{ color: 'var(--lux-secondary)', fontSize: '1.2rem' }}>Start for free, scale as you grow.</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem' }}>
                    {[
                        { name: 'Starter', price: '$0', features: ['5 Projects', 'Basic Analytics', 'Community Support'] },
                        { name: 'Pro', price: '$49', features: ['Unlimited Projects', 'Advanced Analytics', 'Priority Support', 'API Access'], highlight: true },
                        { name: 'Business', price: '$199', features: ['Dedicated Hardware', 'SLA', 'Account Manager', 'Custom Integrations'] }
                    ].map((plan, i) => (
                        <div key={i} className="widget" style={{
                            padding: '3rem',
                            border: plan.highlight ? '1px solid var(--accent-cyan)' : '1px solid var(--glass-border)',
                            position: 'relative',
                            display: 'flex',
                            flexDirection: 'column',
                            background: plan.highlight ? 'rgba(0,240,255,0.03)' : 'var(--bg-panel)'
                        }}>
                            {plan.highlight && (
                                <div style={{
                                    position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                                    background: 'var(--accent-cyan)', color: '#000', padding: '0.25rem 1rem', borderRadius: '99px',
                                    fontSize: '0.8rem', fontWeight: 700, boxShadow: '0 0 20px rgba(0,240,255,0.4)'
                                }}>MOST POPULAR</div>
                            )}
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 500, marginBottom: '0.5rem', color: plan.highlight ? 'var(--accent-cyan)' : 'var(--lux-primary)' }}>{plan.name}</h3>
                            <div style={{ fontSize: '3rem', fontWeight: 700, marginBottom: '2rem' }}>{plan.price}<span style={{ fontSize: '1rem', fontWeight: 400, color: 'var(--lux-tertiary)' }}>/mo</span></div>
                            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 3rem 0', flex: 1 }}>
                                {plan.features.map((f, k) => (
                                    <li key={k} style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--lux-secondary)' }}>
                                        <CheckCircle2 size={16} color={plan.highlight ? 'var(--accent-cyan)' : 'var(--lux-tertiary)'} /> {f}
                                    </li>
                                ))}
                            </ul>
                            <button
                                onClick={onLogin}
                                className={plan.highlight ? "hud-btn primary" : "hud-btn"}
                                style={{
                                    width: '100%',
                                    padding: '1rem',
                                    justifyContent: 'center',
                                    color: plan.highlight ? '#000' : 'var(--lux-primary)'
                                }}
                            >
                                Get Started
                            </button>
                        </div>
                    ))}
                </div>
            </section>

            {/* Developers Section */}
            <section id="developers" style={{
                background: 'rgba(0,0,0,0.3)',
                padding: '8rem 2rem',
                borderTop: '1px solid var(--glass-border)',
                borderBottom: '1px solid var(--glass-border)'
            }}>
                <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6rem', alignItems: 'center' }}>
                    <div style={{ order: 2 }}>
                        <div style={{ color: 'var(--accent-cyan)', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Code size={18} /> DEVELOPERS
                        </div>
                        <h2 style={{ fontSize: '3.5rem', fontWeight: 500, lineHeight: 1.1, marginBottom: '2rem' }}>
                            API first.<br />Headless always.
                        </h2>
                        <p style={{ color: 'var(--lux-secondary)', fontSize: '1.1rem', marginBottom: '2rem', lineHeight: 1.6 }}>
                            Interact with TeamPilot programmatically. Create jobs, retrieve data, and manage your account through our REST API.
                        </p>
                        <div style={{ display: 'flex', gap: '2rem', color: 'var(--lux-tertiary)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Terminal size={18} /> CLI Tool</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><FileText size={18} /> Documentation</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Lock size={18} /> Secure Keys</div>
                        </div>
                    </div>
                    <div style={{
                        background: 'rgba(0,0,0,0.6)',
                        borderRadius: '16px',
                        padding: '2rem',
                        border: '1px solid var(--glass-border)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.9rem',
                        color: 'var(--accent-success)'
                    }}>
                        <div style={{ color: 'var(--lux-tertiary)', marginBottom: '1rem' }}>// Initialize Client</div>
                        <div style={{ color: 'var(--accent-success)' }}>const client = new TeamPilot({'{'}</div>
                        <div style={{ paddingLeft: '1.5rem', color: 'var(--lux-primary)' }}>apiKey: process.env.TEAMPILOT_KEY</div>
                        <div style={{ color: 'var(--accent-success)' }}>{'}'});</div>
                        <br />
                        <div style={{ color: 'var(--lux-tertiary)', marginBottom: '1rem' }}>// Run Analysis Job</div>
                        <div style={{ color: 'var(--accent-success)' }}>const job = await client.jobs.create({'{'}</div>
                        <div style={{ paddingLeft: '1.5rem', color: 'var(--lux-primary)' }}>type: 'lead_enrichment',</div>
                        <div style={{ paddingLeft: '1.5rem', color: 'var(--lux-primary)' }}>input: {'{'} domain: 'example.com' {'}'}</div>
                        <div style={{ color: 'var(--accent-success)' }}>{'}'});</div>
                        <br />
                        <div style={{ color: 'var(--lux-tertiary)' }}>console.log(job.status); // "processing"</div>
                    </div>
                </div>
            </section>

            {/* FAQ Section */}
            <section id="faq" style={{
                maxWidth: '800px',
                margin: '8rem auto',
                padding: '0 2rem'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
                    <h2 style={{ fontSize: '2.5rem', fontWeight: 500, marginBottom: '1rem' }}>Frequently Asked Questions</h2>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {[
                        { q: 'How does the billing work?', a: 'We charge monthly based on your plan. You can cancel at any time.' },
                        { q: 'Can I invite my team?', a: 'Yes, the Pro and Business plans support multiple team members with role-based access.' },
                        { q: 'Do you offer an SLA?', a: 'Business plans come with a 99.9% uptime SLA and priority support.' },
                        { q: 'Is my data secure?', a: 'We use bank-level encryption and are SOC2 Type II compliant.' }
                    ].map((item, i) => (
                        <div key={i} className="widget" style={{ padding: '1.5rem' }}>
                            <h4 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--lux-primary)' }}>{item.q}</h4>
                            <p style={{ color: 'var(--lux-secondary)', margin: 0 }}>{item.a}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Testimonial / Footer Teaser */}
            <section style={{
                maxWidth: '1200px',
                margin: '0 auto 8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '4rem'
            }}>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#333', overflow: 'hidden', border: '2px solid var(--glass-border)' }}>
                        <img src="https://i.pravatar.cc/150?u=1" alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(100%)' }} />
                    </div>
                    <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#333', overflow: 'hidden', border: '2px solid var(--glass-border)' }}>
                        <img src="https://i.pravatar.cc/150?u=2" alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(100%)' }} />
                    </div>
                    <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontWeight: 700 }}>
                        +8
                    </div>
                </div>

                <div style={{ fontSize: '2rem', fontFamily: 'serif', fontStyle: 'italic', color: 'var(--lux-tertiary)' }}>/</div>

                <div>
                    <p style={{ fontSize: '1.2rem', color: 'var(--lux-secondary)', marginBottom: '1rem' }}>
                        "Trigger help us to automation we got more than 2X leads which help to grow agency."
                    </p>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--lux-primary)' }}>Daniel, Design Lead @Google</div>
                </div>
            </section>

            <footer style={{
                borderTop: '1px solid var(--glass-border)',
                padding: '2rem 0',
                textAlign: 'center',
                color: 'var(--lux-tertiary)',
                fontSize: '0.9rem'
            }}>
                &copy; 2024 TeamPilot Inc. All rights reserved.
            </footer>

            {/* Auth Modal */}
            <AuthModal
                isOpen={showAuthModal}
                onClose={() => {
                    setShowAuthModal(false);
                    // If user just signed in, navigate to dashboard
                    if (user) {
                        if (onEnter) onEnter();
                        if (onLoginProp) onLoginProp();
                    }
                }}
                initialMode={authMode}
            />
        </div>
    );
};

export default LandingPage;
