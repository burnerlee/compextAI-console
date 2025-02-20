import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Bot, User, ChevronDown, ChevronUp, Link as LinkIcon, Settings, Loader } from 'lucide-react';
import { executionApi, Execution } from '../lib/api/execution';
import { ExpandableMessage } from '../components/ExpandableMessage';
import { ExpandableJson } from '../components/ExpandableJson';
import { ReExecuteSection } from '../components/ReExecuteSection';
import { ScrollButtons } from '../components/ScrollButtons';
import { Message } from '../lib/api/conversation';

export function ExecutionView() {
  const { executionId, projectName } = useParams();
  const navigate = useNavigate();
  const [execution, setExecution] = useState<Execution | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [systemPrompt, setSystemPrompt] = useState<string | null>(null);
  const [isConversationExpanded, setIsConversationExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  function getOutputContent(output: any, contentStr: string): string {
  // check if output is a string
  if (typeof output === 'string') {
    return output;
  }
  // check if output is an array of objects
  let finalOutput = "";
  if (Array.isArray(output) && output.every(item => typeof item === 'object')) {
    for (const item of output) {
      switch (item.type) {
        case 'text':
          finalOutput += `${item.text}\n`;
          break;
        case 'tool_use':
          finalOutput += `\nTool used: ${item.name}\nInput: ${JSON.stringify(item.input)}\n`;
          break;
      }
    }
    return finalOutput;
  }

  return contentStr;
}

function decodeBase64Image(data: string): string {
  return `data:image/jpeg;base64,${data}`;
}

const getMessageContent = (message: Message) => {
  if (typeof message.content === 'object') {
    return JSON.stringify(message.content);
  }
  
  if (message.tool_calls && message.tool_calls.length > 0) {
    let content = message.content;
    message.tool_calls.forEach(toolCall => {
      content += `\n\nTool Call: ${toolCall.function.name}\nArguments:\n${JSON.stringify(JSON.parse(toolCall.function.arguments), null, 2)}`;
    });
    return content;
  }

  return message.content;
}

// returns an html element with the content
function getInputMessageContent(content: any): string {
  let finalOutput = "";
  for (const item of content) {
    switch (item.type) {
      case 'text':
        finalOutput += `\n${item.text}\n`;
        break;
      case 'tool_use':
        finalOutput += `\nTool used: ${item.name}\nInput: ${JSON.stringify(item.input)}\n`;
        break;
      case 'image':
        // implement image rendering later
        finalOutput += `\n[Image]\n`;
        break;
      case 'tool_result':
        finalOutput += `\n${JSON.stringify(item.content)}\n`;
        break;
    }
  }
  return finalOutput;
}

  useEffect(() => {
    if (executionId) {
      fetchExecution();
    }
  }, [executionId]);

  const fetchExecution = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await executionApi.get(executionId!);
      setExecution(data);
      const systemMessage = data.input_messages.find(msg => msg.role === 'system');
      setSystemPrompt(data.system_prompt || (systemMessage ? systemMessage.content : null));
    } catch (err: any) {
      console.error('Error fetching execution:', err);
      setError(err.message || 'Failed to fetch execution');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    navigate(`/project/${projectName}/executions`, { replace: false });
  };

  const handleReExecute = (newExecutionId: string) => {
    navigate(`/project/${projectName}/executions/${newExecutionId}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !execution) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-center items-center h-64">
            <div className="text-red-600">{error || 'Execution not found'}</div>
          </div>
        </div>
      </div>
    );
  }

  const messages = execution.input_messages.filter(msg => msg.role !== 'system');
  
  console.log("messages", messages);
  console.log("execution", execution);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft size={20} />
          <span>Back to Executions</span>
        </button>

        <div className="space-y-6">
          {/* Execution Header */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h1 className="text-2xl font-semibold">Execution {execution.identifier}</h1>
                <p className="text-sm text-gray-500 mt-1">
                  Created at: {new Date(execution.created_at).toLocaleString()}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-sm text-gray-500">Thread ID: {execution.thread_id}</p>
                  {execution.thread_id !== 'compext_thread_null' && (
                    <button
                      onClick={() => navigate(`/project/${projectName}/threads/${execution.thread_id}`)}
                      className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                    >
                      <LinkIcon size={14} />
                      <span>View Thread</span>
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-sm ${
                  execution.status === 'completed' ? 'bg-green-100 text-green-800' :
                  execution.status === 'failed' ? 'bg-red-100 text-red-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {execution.status.charAt(0).toUpperCase() + execution.status.slice(1)}
                </span>
              </div>
            </div>

            {execution.execution_time && execution.execution_time > 0 ? (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-gray-500">Execution Time: {execution.execution_time}s</span>
              </div>
            ):(<div></div>)}

            {/* Execution Parameters */}
            {execution.thread_execution_params_template && (
              <div className="mt-6 border-t border-gray-200 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Settings size={18} className="text-gray-500" />
                    <h2 className="text-lg font-medium">Execution Parameters</h2>
                  </div>
                  {execution.thread_execution_params_template_id && (
                    <button
                      onClick={() => navigate(`/project/${projectName}/templates/${execution.thread_execution_params_template_id}`)}
                      className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                    >
                      <LinkIcon size={14} />
                      <span>View Template</span>
                    </button>
                  )}
                </div>
                <div className='flex flex-col gap-4'>
                <div>
                    <span className="text-sm text-gray-500 block">Template Name</span>
                    <span className="font-medium">{execution.thread_execution_params_template.name}</span>
                  </div>
                </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                    <span className="text-sm text-gray-500 block">Model</span>
                    <span className="font-medium">{execution.thread_execution_params_template.model}</span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500 block">Temperature</span>
                    <span className="font-medium">{execution.thread_execution_params_template.temperature}</span>
                  </div>
                  {(execution?.thread_execution_params_template?.max_tokens ?? 0) > 0 && (
                    <div>
                      <span className="text-sm text-gray-500 block">Max Tokens</span>
                      <span className="font-medium">{execution.thread_execution_params_template.max_tokens}</span>
                    </div>
                  )}
                  {(execution?.thread_execution_params_template?.max_completion_tokens ?? 0) > 0 && (
                    <div>
                      <span className="text-sm text-gray-500 block">Max Completion Tokens</span>
                      <span className="font-medium">{execution.thread_execution_params_template.max_completion_tokens}</span>
                    </div>
                  )}
                  {(execution?.thread_execution_params_template?.top_p ?? 0) > 0 && (
                    <div>
                      <span className="text-sm text-gray-500 block">Top P</span>
                      <span className="font-medium">{execution.thread_execution_params_template.top_p}</span>
                    </div>
                  )}
                  {(execution?.thread_execution_params_template?.max_output_tokens ?? 0) > 0 && (
                    <div>
                      <span className="text-sm text-gray-500 block">Max Output Tokens</span>
                      <span className="font-medium">{execution.thread_execution_params_template.max_output_tokens}</span>
                    </div>
                  )}
                  {(execution?.thread_execution_params_template?.timeout ?? 0) > 0 && (
                    <div>
                      <span className="text-sm text-gray-500 block">Timeout</span>
                      <span className="font-medium">{execution.thread_execution_params_template.timeout}s</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-lg font-medium mb-4">Re-execute with Different Configuration</h3>
              <ReExecuteSection
                projectName={projectName!}
                executionId={execution.identifier}
                onReExecute={handleReExecute}
              />
            </div>
          </div>

          {/* Conversation section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <button
              onClick={() => setIsConversationExpanded(!isConversationExpanded)}
              className="w-full px-6 py-4 flex items-center justify-between text-left border-b border-gray-200"
            >
              <h2 className="text-lg font-medium">Conversation</h2>
              {isConversationExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>

            {isConversationExpanded && (
              <>
                {systemPrompt && (
                  <div className="p-4 bg-gray-50 border-b border-gray-200">
                    <div className="max-w-3xl mx-auto">
                      <div className="text-sm text-gray-600">
                        <span className="font-medium text-gray-700">System Prompt: </span>
                        <ExpandableMessage content={systemPrompt} isUser={false} />
                      </div>
                    </div>
                  </div>
                )}

                <div ref={containerRef} className="p-6 space-y-6 max-h-[600px] overflow-y-auto">
                  {messages.map((message, index) => {
                    const isUser = message.role === 'user';
                    return (
                      <div
                        key={index}
                        className={`flex ${isUser ? 'justify-start' : 'justify-end'} gap-3 max-w-[85%] ${
                          isUser ? 'ml-0' : 'ml-auto'
                        }`}
                      >
                        {isUser && (
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                            <User size={16} className="text-gray-600" />
                          </div>
                        )}
                        <div className={`flex flex-col ${isUser ? 'items-start' : 'items-end'} flex-1`}>
                          <div
                            className={`w-full rounded-2xl px-4 py-3 ${
                              isUser ? 'bg-gray-100 text-gray-900' : 'bg-blue-600 text-white'
                            }`}
                          >
                            <ExpandableMessage content={getMessageContent(message)} isUser={isUser} />
                          </div>
                        </div>
                        {!isUser && (
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                            <Bot size={16} className="text-blue-600" />
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {execution.content && (
                    <div className="flex justify-end gap-3 max-w-[85%] ml-auto">
                      <div className="flex flex-col items-end flex-1">
                        <div className="w-full rounded-2xl px-4 py-3 bg-blue-600 text-white">
                          <ExpandableMessage content={execution.content} isUser={false} />
                        </div>
                      </div>
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <Bot size={16} className="text-blue-600" />
                      </div>
                    </div>
                  )}

                  {execution.status === 'running' && (
                    <div className="flex justify-center">
                      <div className="flex items-center gap-2 text-blue-600">
                        <Loader className="animate-spin" size={20} />
                        <span>Execution in progress...</span>
                      </div>
                    </div>
                  )}
                </div>
                <ScrollButtons containerRef={containerRef} />
              </>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
            <h2 className="text-lg font-medium mb-4">Execution Output</h2>
            <div>
              <span className="text-sm text-gray-500 block">Output</span>
              {execution.status === 'completed' && (
                <ExpandableMessage content={getOutputContent(execution?.output?.content, execution?.content)} isUser={false} />
              )}
              {execution.status === 'failed' && (
                <span className="text-red-600">{execution?.output?.error || 'Execution failed'}</span>
              )}
              {execution.status === 'in_progress' && (
                <span className="text-blue-600 animate-pulse">Execution in progress...</span>
              )}
            </div>
          </div>

          {/* Metadata Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
            <h2 className="text-lg font-medium mb-4">Additional Information</h2>
            {execution.thread_execution_params_template?.response_format && (
              <ExpandableJson 
                data={execution.thread_execution_params_template.response_format} 
                title="Response Format"
              />
            )}
            
            {execution.execution_response_metadata && (
              <ExpandableJson 
                data={execution.execution_response_metadata} 
                title="Response Metadata"
              />
            )}
            
            {execution.execution_request_metadata && (
              <ExpandableJson 
                data={execution.execution_request_metadata} 
                title="Request Metadata"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}