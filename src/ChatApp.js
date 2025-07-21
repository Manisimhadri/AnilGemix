import React, { useEffect, useRef, useState } from 'react';
import { Send, Moon, Sun, MessageSquare, User, Sparkles, Code, FileText, Brain } from "lucide-react";
import ReactMarkDown from "react-markdown";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAi = new GoogleGenerativeAI(process.env.REACT_APP_GEMINI_API_KEY);
// Using the standard model instead of pro for higher quotas
const model = genAi.getGenerativeModel({ model: "gemini-1.5-flash" });

// Rate limiting settings
const RATE_LIMIT = {
    MAX_REQUESTS_PER_MINUTE: 10,
    REQUESTS_WINDOW_MS: 60000, // 1 minute
};

// Define color themes
const themes = {
    coolTones: {
        primary: "#3a7bd5",
        secondary: "#5b5fc7",
        background: "#f4f6fc",
        darkModeBackground: "#2b2d42",
        textColor: "#333",
        buttonAccent: "#20c997",
    },
    mutedEarthTones: {
        primary: "#3a6351",
        secondary: "#e1b12c",
        background: "#f7f6f3",
        darkModeBackground: "#2f3640",
        textColor: "#2e2e2e",
        buttonAccent: "#ff6f61",
    },
    minimalistNeutrals: {
        primary: "#6c77bb",
        secondary: "#a3b1c6",
        background: "#f8f9fa",
        darkModeBackground: "#1f1f1f",
        textColor: "#121212",
        buttonAccent: "#f3c623",
    },
    soothingPastels: {
        primary: "#a0e1e5",
        secondary: "#ffcbcb",
        background: "#eafff5",
        darkModeBackground: "#0c1446",
        textColor: "#204051",
        buttonAccent: "#ffaf87",
    },
};

function ChatApp() {
    const [messages, setMessages] = useState([
        { sender: "user", text: "" },
        { sender: "ai", text: "Hello! I'm your AI assistant. I can help you with:\n\n- Code analysis and generation\n- Text processing and summarization\n- Image analysis and description\n- General knowledge and problem-solving\n\nHow can I assist you today?" }
    ]);
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const [inputType, setInputType] = useState("text"); // text, code, image
    const [suggestions, setSuggestions] = useState([]);
    const [isRateLimited, setIsRateLimited] = useState(false);
    const [rateLimitReset, setRateLimitReset] = useState(null);
    const messageEndRef = useRef(null);
    const chatSessionRef = useRef(null);
    const requestCountRef = useRef(0);
    const lastRequestTimeRef = useRef(Date.now());
    const [darkMode, setDarkMode] = useState(false);
    const [theme, setTheme] = useState(themes.coolTones);
    const [showSuggestions, setShowSuggestions] = useState(false);

    const scrollToBottom = () => {
        messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
        if (!chatSessionRef.current) {
            chatSessionRef.current = model.startChat({
                generationConfig: {
                    temperature: 0.9,
                    topK: 1,
                    topP: 1,
                    maxOutputTokens: 2048,
                },
                history: [],
            });
        }
    }, [messages]);

    const analyzeInput = (text) => {
        // Basic input analysis
        const codePattern = /```[\s\S]*?```/g;
        
        if (codePattern.test(text)) {
            return "code";
        }
        return "text";
    };

    const generateSuggestions = (text) => {
        if (!text) return [];
        
        const suggestions = [];
        if (text.toLowerCase().includes("code")) {
            suggestions.push("Generate a function to...");
            suggestions.push("Debug this code...");
            suggestions.push("Optimize this algorithm...");
        }
        if (text.toLowerCase().includes("image")) {
            suggestions.push("Analyze this image...");
            suggestions.push("Describe this picture...");
            suggestions.push("Generate an image of...");
        }
        if (text.toLowerCase().includes("help")) {
            suggestions.push("What can you do?");
            suggestions.push("Show me some examples");
            suggestions.push("How do I use this?");
        }
        return suggestions;
    };

    const handleInputChange = (e) => {
        const newInput = e.target.value;
        setInput(newInput);
        const type = analyzeInput(newInput);
        setInputType(type);
        setSuggestions(generateSuggestions(newInput));
        setShowSuggestions(newInput.length > 0);
    };

    const handleSuggestionClick = (suggestion) => {
        setInput(suggestion);
        setShowSuggestions(false);
    };

    // Rate limiting function
    const checkRateLimit = () => {
        const now = Date.now();
        if (now - lastRequestTimeRef.current > RATE_LIMIT.REQUESTS_WINDOW_MS) {
            // Reset counter if window has passed
            requestCountRef.current = 0;
            lastRequestTimeRef.current = now;
        }

        if (requestCountRef.current >= RATE_LIMIT.MAX_REQUESTS_PER_MINUTE) {
            const resetTime = new Date(lastRequestTimeRef.current + RATE_LIMIT.REQUESTS_WINDOW_MS);
            setRateLimitReset(resetTime);
            setIsRateLimited(true);
            return false;
        }

        requestCountRef.current++;
        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!input.trim()) return;

        // Check rate limit before proceeding
        if (!checkRateLimit()) {
            const timeUntilReset = Math.ceil((rateLimitReset - Date.now()) / 1000);
            setMessages((prev) => [...prev, {
                sender: "ai",
                text: `⚠️ Rate limit exceeded. Please wait ${timeUntilReset} seconds before sending another message.`,
                type: "error"
            }]);
            return;
        }

        const inputType = analyzeInput(input);
        setMessages((prev) => [...prev, { 
            sender: "user", 
            text: input,
            type: inputType
        }]);
        setInput("");
        setIsTyping(true);
        setShowSuggestions(false);

        try {
            let fullResponse = "";
            const result = await chatSessionRef.current.sendMessageStream(input);

            setMessages((prev) => [
                ...prev,
                { sender: "ai", text: "", isGenerating: true, type: inputType }
            ]);

            // eslint-disable-next-line no-loop-func
            for await (const chunk of result.stream) {
                const chunkText = chunk.text();
                fullResponse += chunkText;

                setMessages((prev) => {
                    const newMessages = [...prev.slice(0, -1)];
                    newMessages.push({ sender: "ai", text: fullResponse, isGenerating: true, type: inputType });
                    return newMessages;
                });
            }

            setMessages((prev) => [
                ...prev.slice(0, -1),
                { sender: "ai", text: fullResponse, isGenerating: false, type: inputType }
            ]);
            setIsTyping(false);
        } catch (error) {
            console.log(error);
            setIsTyping(false);
            
            // Handle quota exceeded error specifically
            if (error.message?.includes('quota')) {
                setMessages((prev) => [
                    ...prev,
                    { 
                        sender: "ai", 
                        text: "⚠️ API quota exceeded. The service is temporarily unavailable. Please try again in a few minutes.",
                        type: "error"
                    }
                ]);
                // Set rate limit for 5 minutes when quota is exceeded
                setRateLimitReset(new Date(Date.now() + 300000));
                setIsRateLimited(true);
            } else {
                setMessages((prev) => [
                    ...prev,
                    { 
                        sender: "ai", 
                        text: "Sorry, there was an error processing your request. Please try again.",
                        type: "error"
                    }
                ]);
            }
        }
    };

    const MarkDownComponent = {
        code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");

            return !inline && match ? (
                <SyntaxHighlighter
                    style={vscDarkPlus}
                    language={match[1]}
                    PreTag="div"
                    {...props}
                >
                    {String(children).replace(/\n$/, "")}
                </SyntaxHighlighter>
            ) : (
                <code className={className} {...props}>
                    {children}
                </code>
            );
        },
        h1: ({ node, children, ...props }) => (
            <h1 style={{ fontSize: "2em", fontWeight: "bold" }} {...props}>{children}</h1>
        ),
        h2: ({ node, children, ...props }) => (
            <h2 style={{ fontSize: "1.5em", fontWeight: "bold" }} {...props}>{children}</h2>
        ),
        h3: ({ node, children, ...props }) => (
            <h3 style={{ fontSize: "1.17em", fontWeight: "bold" }} {...props}>{children}</h3>
        ),
    };

    const toggleDarkMode = () => setDarkMode(!darkMode);

    const handleThemeChange = (themeName) => {
        setTheme(themes[themeName]);
    };

    return (
        <div className={`flex flex-col h-screen relative transition-colors duration-500`} style={{ 
            backgroundColor: darkMode ? theme.darkModeBackground : theme.background, 
            color: darkMode ? "white" : theme.textColor,
            backgroundImage: darkMode 
                ? `linear-gradient(135deg, ${theme.darkModeBackground} 0%, ${theme.primary}22 100%)`
                : `linear-gradient(135deg, ${theme.background} 0%, ${theme.primary}11 100%)`
        }}>
            <style>{`
                @keyframes typing {
                    0% { opacity: 0.3; }
                    50% { opacity: 1; }
                    100% { opacity: 0.3; }
                }
                @keyframes slideIn {
                    from {
                        transform: translateY(20px);
                        opacity: 0;
                    }
                    to {
                        transform: translateY(0);
                        opacity: 1;
                    }
                }
                @keyframes pulse {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                    100% { transform: scale(1); }
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes float {
                    0% { transform: translateY(0px); }
                    50% { transform: translateY(-10px); }
                    100% { transform: translateY(0px); }
                }
                .typing-animation {
                    animation: typing 2s infinite;
                }
                @keyframes sparkle {
                    0% { transform: scale(1) rotate(0deg); opacity: 0; }
                    50% { transform: scale(1.2) rotate(180deg); opacity: 1; }
                    100% { transform: scale(1) rotate(360deg); opacity: 0; }
                }
                .sparkle-effect {
                    position: absolute;
                    pointer-events: none;
                    animation: sparkle 2s linear infinite;
                }
                .message-animation {
                    animation: slideIn 0.3s ease-out;
                }
                .button-hover {
                    transition: all 0.3s ease;
                }
                .button-hover:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                }
                .theme-transition {
                    transition: all 0.5s ease;
                }
                .background-watermark {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    font-size: 5rem;
                    color: rgba(200, 200, 200, 0.1);
                    font-weight: bold;
                    user-select: none;
                    pointer-events: none;
                    text-transform: uppercase;
                    z-index: 0;
                    animation: fadeIn 1s ease-out;
                }
                .message-bubble {
                    transition: all 0.3s ease;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                }
                .message-bubble:hover {
                    transform: scale(1.02);
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
                }
                .theme-selector {
                    transition: all 0.3s ease;
                }
                .theme-selector:hover {
                    transform: translateY(-2px);
                }
                .glass-effect {
                    background: rgba(255, 255, 255, 0.1);
                    backdrop-filter: blur(10px);
                    -webkit-backdrop-filter: blur(10px);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                }
                .floating-icon {
                    animation: float 3s ease-in-out infinite;
                }
                .gradient-border {
                    position: relative;
                }
                .gradient-border::after {
                    content: '';
                    position: absolute;
                    top: -2px;
                    left: -2px;
                    right: -2px;
                    bottom: -2px;
                    background: linear-gradient(45deg, ${theme.primary}, ${theme.secondary});
                    z-index: -1;
                    border-radius: 16px;
                    opacity: 0.5;
                }
                .suggestion-item {
                    transition: all 0.2s ease;
                }
                .suggestion-item:hover {
                    transform: translateX(5px);
                    background: rgba(255, 255, 255, 0.1);
                }
                .input-type-indicator {
                    position: absolute;
                    right: 10px;
                    top: 50%;
                    transform: translateY(-50%);
                    opacity: 0.7;
                }
                @keyframes watermarkFloat {
                    0% { transform: translate(-50%, -50%) scale(1) rotate(0deg); opacity: 0.15; }
                    25% { transform: translate(-50%, -50%) scale(1.05) rotate(5deg); opacity: 0.25; }
                    50% { transform: translate(-50%, -50%) scale(1) rotate(0deg); opacity: 0.15; }
                    75% { transform: translate(-50%, -50%) scale(0.95) rotate(-5deg); opacity: 0.25; }
                    100% { transform: translate(-50%, -50%) scale(1) rotate(0deg); opacity: 0.15; }
                }
                @keyframes headerGlow {
                    0% { box-shadow: 0 0 5px rgba(255, 255, 255, 0.1); }
                    50% { box-shadow: 0 0 20px rgba(255, 255, 255, 0.2); }
                    100% { box-shadow: 0 0 5px rgba(255, 255, 255, 0.1); }
                }
                .animated-watermark {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    font-size: 6rem;
                    font-weight: 900;
                    user-select: none;
                    pointer-events: none;
                    text-transform: uppercase;
                    z-index: 0;
                    animation: watermarkFloat 10s ease-in-out infinite;
                    background: linear-gradient(45deg, ${theme.primary}, ${theme.secondary});
                    -webkit-background-clip: text;
                    background-clip: text;
                    color: transparent;
                    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
                    letter-spacing: 2px;
                }
                .header-container {
                    position: relative;
                    overflow: hidden;
                }
                .header-container::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: linear-gradient(90deg, 
                        transparent 0%, 
                        rgba(255, 255, 255, 0.1) 50%, 
                        transparent 100%
                    );
                    animation: headerGlow 3s ease-in-out infinite;
                }
                .header-title {
                    position: relative;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                .header-title::after {
                    content: '';
                    position: absolute;
                    bottom: -2px;
                    left: 0;
                    width: 100%;
                    height: 2px;
                    background: linear-gradient(90deg, 
                        transparent, 
                        ${theme.buttonAccent}, 
                        transparent
                    );
                }
                .header-icon {
                    animation: float 3s ease-in-out infinite;
                }
                .header-sparkle {
                    position: absolute;
                    width: 4px;
                    height: 4px;
                    border-radius: 50%;
                    background-color: ${theme.buttonAccent};
                    animation: sparkle 2s linear infinite;
                }
                .send-button {
                    position: relative;
                    overflow: hidden;
                    transition: all 0.3s ease;
                }
                .send-button::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: -100%;
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(
                        90deg,
                        transparent,
                        rgba(255, 255, 255, 0.2),
                        transparent
                    );
                    transition: 0.5s;
                }
                .send-button:hover::before {
                    left: 100%;
                }
                .send-button-glow {
                    box-shadow: 0 0 15px rgba(255, 255, 255, 0.3);
                }
            `}</style>

            <div className="animated-watermark">Anil Gemix</div>

            <header className={`p-4 flex justify-between z-10 theme-transition glass-effect header-container`} style={{ 
                backgroundColor: darkMode ? 'rgba(51, 51, 51, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                color: darkMode ? 'white' : theme.textColor,
                borderBottom: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)'
            }}>
                <div className="header-title">
                    <MessageSquare className="header-icon" size={28} style={{ color: theme.buttonAccent }} />
                    <h1 className="text-2xl font-bold tracking-wide">AnilGemix</h1>
                    <Sparkles className="header-sparkle" style={{ top: '20%', left: '60%' }} />
                    <Sparkles className="header-sparkle" style={{ top: '60%', left: '80%', animationDelay: '0.5s' }} />
                    <Sparkles className="header-sparkle" style={{ top: '40%', left: '40%', animationDelay: '1s' }} />
                </div>
                <div className="flex space-x-3">
                    <button 
                        onClick={toggleDarkMode} 
                        className="focus:outline-none p-2 rounded-lg button-hover glass-effect transition-all duration-300"
                        style={{
                            backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                            border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'}`
                        }}
                    >
                        {darkMode ? <Sun size={24} /> : <Moon size={24} />}
                    </button>
                    <select 
                        onChange={(e) => handleThemeChange(e.target.value)} 
                        className="bg-white text-black rounded-lg hover:bg-gray-200 theme-selector glass-effect px-3 py-1"
                        style={{
                            border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'}`,
                            backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.9)'
                        }}
                    >
                        <option value="coolTones">Cool Tones</option>
                        <option value="mutedEarthTones">Muted Earth Tones</option>
                        <option value="minimalistNeutrals">Minimalist Neutrals</option>
                        <option value="soothingPastels">Soothing Pastels</option>
                    </select>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 z-10">
                {messages.map((message, index) => (
                    <div
                        key={index}
                        className={`mb-4 message-animation ${message.sender === "user" ? "text-right" : "text-left"}`}
                    >
                        <div className="flex items-center space-x-2 mb-1">
                            {message.sender === "user" ? (
                                <User size={16} className="ml-auto" />
                            ) : (
                                <Brain size={16} className="text-purple-500" />
                            )}
                            {message.type === "code" && <Code size={16} className="text-blue-500" />}
                        </div>
                        <div
                            className={`inline-block p-3 rounded-lg message-bubble gradient-border ${
                                message.sender === "user"
                                    ? `bg-${theme.buttonAccent}`
                                    : darkMode
                                        ? "bg-gray-700 text-white"
                                        : "bg-gray-200 text-black"
                            }`}
                        >
                            {message.sender === "user" ? (
                                message.text
                            ) : (
                                <ReactMarkDown
                                    className={`prose max-w-none ${message.isGenerating ? "typing-animation" : ""}`}
                                    components={MarkDownComponent}
                                >
                                    {message.text || "Thinking...."}
                                </ReactMarkDown>
                            )}
                        </div>
                    </div>
                ))}

                {isTyping && (
                    <div className="text-left message-animation">
                        <div className="inline-block rounded-lg bg-gray-300 px-3 py-2 glass-effect">
                            <span className="typing-animation">Analyzing and responding...</span>
                        </div>
                    </div>
                )}
                <div ref={messageEndRef} />
            </div>

            <div className="relative">
                {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute bottom-full left-0 right-0 mb-2 glass-effect rounded-lg p-2">
                        {suggestions.map((suggestion, index) => (
                            <div
                                key={index}
                                className="suggestion-item p-2 rounded cursor-pointer"
                                onClick={() => handleSuggestionClick(suggestion)}
                            >
                                {suggestion}
                            </div>
                        ))}
                    </div>
                )}
                <form className="p-4 flex z-10 glass-effect" onSubmit={handleSubmit} style={{
                    borderTop: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                }}>
                    <div className="relative flex-1">
                        <input
                            type="text"
                            value={input}
                            placeholder={isRateLimited ? `Rate limited. Please wait until ${rateLimitReset?.toLocaleTimeString()}` : "Type a message..."}
                            onChange={handleInputChange}
                            disabled={isRateLimited}
                            className={`w-full p-3 rounded-lg border transition-all duration-300 ${
                                darkMode ? "border-gray-600" : "border-gray-300"
                            } bg-${darkMode ? "gray-700" : "white"} text-${darkMode ? "white" : "black"} focus:outline-none focus:ring-2 focus:ring-${theme.buttonAccent} ${
                                isRateLimited ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                        />
                        <div className="input-type-indicator">
                            {inputType === "code" && <Code size={20} className="text-blue-500" />}
                            {inputType === "text" && <FileText size={20} className="text-gray-500" />}
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={isRateLimited}
                        className={`ml-2 px-6 py-3 rounded-lg text-white send-button send-button-glow ${
                            theme === themes.coolTones ? "bg-teal-500" :
                            theme === themes.mutedEarthTones ? "bg-red-400" :
                            theme === themes.minimalistNeutrals ? "bg-yellow-400" : "bg-pink-500"
                        } hover:bg-opacity-90 focus:outline-none transition duration-300 transform hover:scale-105 ${
                            isRateLimited ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                    >
                        <Send size={24} />
                    </button>
                </form>
            </div>
        </div>
    );
}

export default ChatApp;

