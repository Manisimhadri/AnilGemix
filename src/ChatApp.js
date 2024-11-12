import React, { useEffect, useRef, useState } from 'react'
import {Send} from "lucide-react";
import ReactMarkDown from "react-markdown";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { GoogleGenerativeAI } from '@google/generative-ai';


const genAi = new GoogleGenerativeAI("AIzaSyBcz6v_T2cXWTacqTfoVUDeyHhLJsMg7uI")
const model = genAi.getGenerativeModel({model:"gemini-1.5-pro"})


function ChatApp() {

    const [messages, setMessages] = useState([
        { sender: "user", text: "" },
        { sender: "ai", text: "Hello, how can i help you today!" }
    ]);
    const [input,setInput] = useState("")
    const [isTyping,setIsTyping] = useState(false)
    const messageEndRef = useRef(null)
    const chatSessionRef = useRef(null)

    const scrollToBottom = () =>{
        messageEndRef.current?.scrollIntoView({behavior:"smooth"})
    }

    useEffect(()=>{
        scrollToBottom();
        if(!chatSessionRef.current){
            chatSessionRef.current = model.startChat({
                generationConfig:{
                    temperature:0.9,
                    topK:1,
                    topP:1,
                    maxOutputTokens:2048,
                },
                history:[],
            })
        }
    },[messages])


    const handleSubmit = async (e) => {
        e.preventDefault(); // Ensure the event is properly passed
        if (!input.trim()) return;
    
        setMessages((prev) => [...prev, { sender: "user", text: input }]);
        setInput("");
        setIsTyping(true);

        try{
            let fullResponse = ""
            const result = await chatSessionRef.current.sendMessageStream(input)
            
            setMessages((prev)=>[
                ...prev, 
                {sender:"ai",text:"",isGenerating:true}
            ]);

            for await(const chunk of result.stream){
                const chunkText = chunk.text();
                fullResponse += chunkText
            
                setMessages((prev)=>[
                    ...prev.slice(0,-1), 
                    {sender:"ai", text:fullResponse ,isGenerating:true}
                ]);
 
            }
            setMessages((prev)=>[
                ...prev.slice(0,-1), 
                {sender:"ai", text:fullResponse ,isGenerating:false}
            ]);
            setIsTyping(false);
        }catch(error){
            console.log(error);
            setIsTyping(false);
            setMessages((prev) => [...prev, 
                {   sender: "ai", 
                    text: "Sorry,there was an error ",
                    isGenerating:false,
                }
            ]);
        }
    };


    const MarkDownComponent = {
        code({ node, inline, className, children, ...props }) {
            // Extract the language from the className (e.g., language-js)
            const match = /language-(\w+)/.exec(className || "");
    
            return !inline && match ? (
                <SyntaxHighlighter
                    style={vscDarkPlus} // Apply the style for syntax highlighting
                    language={match[1]} // Use the captured language
                    PreTag="div" // Wrap the code block in a 'div' tag
                    {...props}
                >
                    {String(children).replace(/\n$/, "")} {/* Render the code block */}
                </SyntaxHighlighter>
            ) : (
                <code className={className} {...props}>
                    {children} {/* Inline code handling */}
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
    
    

  return (
    <div className='flexx flex-col h-screen bg-gray-100'>
        <style jsx global>{`

            @Keyframes typing {
                0%{
                    opacity:0.3;
                },
                50%{
                    opacity:1;
                },
                100%{
                    opacity:0.3;
                }
            }

            .typing-animation{
                animation : typing 2s infinite;
            }
        `}
        </style>

        <header className='bg-blue-600 text-white p-4'>
            <h1 className='text-2xl font-bold'>AnilGemix</h1>
        </header>
        <div className="flex-l overflow-y-auto p-4">
            {messages.map((message, index) => (
                <div 
                    key={index} 
                    className={`mb-4 ${message.sender === "user" ? "text-right" : "text-left"}`}
                >
                    <div 
                        className={`inline-block p-2 rounded-lg ${message.sender === "user" 
                            ? "bg-blue-500 text-white" 
                            : "bg-gray-200 text-black"}`}
                    >
                        {message.sender === "user"? (
                            message.text
                        ):(
                            <ReactMarkDown
                                className={`prose max-w-none ${message.isGenerating ? "typing-animation" : ""}` }
                                components={MarkDownComponent}
                            >
                                {message.text || "Thinking...."}
                            </ReactMarkDown>
                        )}

                    </div>
                </div>
            ))}

            {isTyping && (
                <div className='text-left'>
                    <div className='inline-block rounded-lg bg-gray-300 px-2 py-1'>
                        Typing....
                    </div>
                </div>
            )}

            <div ref={messageEndRef}/>
        </div>
        
        <form onSubmit={handleSubmit} className='p-4 bg-white'>
            <div className='flex items-center'>
                <input className='flex-1 p-2 border rounded-l-lg focus:outline'
                 type='text'
                 value={input}
                 placeholder='Type a message...'
                 onChange={(e)=>setInput(e.target.value)}
                 />
                
                <button className='p-2 bg=blue-500 text-white rounded-r-lg bg-blue-600 focus:outline'>
                    <Send size={24}/>
                </button>
                
            </div>
        </form>
    </div>
  )
}

export default ChatApp