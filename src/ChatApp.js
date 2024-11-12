import React, { useEffect, useRef, useState } from 'react';
import { Send, Moon, Sun } from "lucide-react"; // Add Moon and Sun icons for light/dark toggle
import ReactMarkDown from "react-markdown";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAi = new GoogleGenerativeAI(process.env.REACT_APP_GEMINI_API_KEY);
const model = genAi.getGenerativeModel({ model: "gemini-1.5-pro" });

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
        { sender: "ai", text: "Hello, how can I help you today!" }
    ]);
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const messageEndRef = useRef(null);
    const chatSessionRef = useRef(null);
    const [darkMode, setDarkMode] = useState(false); // State for dark mode
    const [theme, setTheme] = useState(themes.coolTones); // Default theme

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

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!input.trim()) return;

        setMessages((prev) => [...prev, { sender: "user", text: input }]);
        setInput("");
        setIsTyping(true);

        try {
            let fullResponse = "";
            const result = await chatSessionRef.current.sendMessageStream(input);

            setMessages((prev) => [
                ...prev,
                { sender: "ai", text: "", isGenerating: true }
            ]);

            for await (const chunk of result.stream) {
                const chunkText = chunk.text();
                fullResponse += chunkText;

                setMessages((prev) => [
                    ...prev.slice(0, -1),
                    { sender: "ai", text: fullResponse, isGenerating: true }
                ]);
            }

            setMessages((prev) => [
                ...prev.slice(0, -1),
                { sender: "ai", text: fullResponse, isGenerating: false }
            ]);
            setIsTyping(false);
        } catch (error) {
            console.log(error);
            setIsTyping(false);
            setMessages((prev) => [
                ...prev,
                { sender: "ai", text: "Sorry, there was an error", isGenerating: false }
            ]);
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
        h1: ({ node, ...props }) => (
            <h1 style={{ fontSize: "2em", fontWeight: "bold" }} {...props} />
        ),
        h2: ({ node, ...props }) => (
            <h2 style={{ fontSize: "1.5em", fontWeight: "bold" }} {...props} />
        ),
        h3: ({ node, ...props }) => (
            <h3 style={{ fontSize: "1.17em", fontWeight: "bold" }} {...props} />
        ),
    };

    const toggleDarkMode = () => setDarkMode(!darkMode);

    const handleThemeChange = (themeName) => {
        setTheme(themes[themeName]);
    };

    return (
        <div className={`flex flex-col h-screen relative`} style={{ backgroundColor: darkMode ? theme.darkModeBackground : theme.background, color: darkMode ? "white" : theme.textColor }}>
            <style jsx global>{`
                @Keyframes typing {
                    0% { opacity: 0.3; }
                    50% { opacity: 1; }
                    100% { opacity: 0.3; }
                }
                .typing-animation {
                    animation: typing 2s infinite;
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
                }
            `}</style>

            <div className="background-watermark">Anil Gemix</div>

            <header className={`p-4 flex justify-between z-10`} style={{ backgroundColor: darkMode ? '#333' : theme.primary, color: 'white' }}>
                <h1 className="text-2xl font-bold">AnilGemix</h1>
                <div className="flex space-x-2">
                    <button onClick={toggleDarkMode} className="focus:outline-none hover:bg-gray-700 p-2 rounded">
                        {darkMode ? <Sun size={24} /> : <Moon size={24} />}
                    </button>
                    <select onChange={(e) => handleThemeChange(e.target.value)} className="bg-white text-black rounded hover:bg-gray-200">
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
                        className={`mb-4 ${message.sender === "user" ? "text-right" : "text-left"}`}
                    >
                        <div
                            className={`inline-block p-2 rounded-lg ${message.sender === "user"
                                ? `bg-${theme.buttonAccent}`
                                : darkMode
                                    ? "bg-gray-700 text-white"
                                    : "bg-gray-200 text-black"}`}
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
                    <div className="text-left">
                        <div className="inline-block rounded-lg bg-gray-300 px-2 py-1">
                            Typing....
                        </div>
                    </div>
                )}
                <div ref={messageEndRef} />
            </div>

            <form className="p-4 flex z-10" onSubmit={handleSubmit}>
                <input
                    type="text"
                    value={input}
                    placeholder="Type a message..."
                    onChange={(e) => setInput(e.target.value)}
                    className={`flex-1 p-2 rounded-lg border ${darkMode ? "border-gray-600" : "border-gray-300"} bg-${darkMode ? "gray-700" : "white"} text-${darkMode ? "white" : "black"}`}
                />
                <button
                    type="submit"
                    className={`ml-2 px-4 py-2 rounded text-white ${
                        theme === themes.coolTones ? "bg-teal-500" :
                        theme === themes.mutedEarthTones ? "bg-red-400" :
                        theme === themes.minimalistNeutrals ? "bg-yellow-400" : "bg-pink-500"
                    } hover:bg-opacity-80 focus:outline-none transition duration-300`}
                >
                    <Send />
                </button>


            </form>
        </div>
    );
}

export default ChatApp;

