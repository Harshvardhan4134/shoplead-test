import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

export interface AIPrediction {
  confidence: number;
  riskLevel: 'Low' | 'Medium' | 'High';
  recommendation: string;
  explanation: string;
}

export async function getJobPrediction(job: any): Promise<AIPrediction> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an expert in manufacturing and production forecasting. Analyze the job data and provide predictions about completion time, risks, and recommendations."
        },
        {
          role: "user",
          content: `Analyze this job:
          Job Number: ${job.job_number}
          Title: ${job.title}
          Status: ${job.status}
          Due Date: ${job.due_date}
          Work Center: ${job.work_center}
          Progress: ${job.progress}%
          Priority: ${job.priority}
          
          Provide a prediction with:
          1. Confidence score (0-100)
          2. Risk level (Low/Medium/High)
          3. Recommendation
          4. Explanation
          
          Format the response as a JSON object with these exact keys:
          {
              "confidence": number,
              "riskLevel": string,
              "recommendation": string,
              "explanation": string
          }`
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    const response = completion.choices[0]?.message?.content;
    if (response) {
      return JSON.parse(response);
    }
  } catch (error) {
    console.error("Error getting job prediction:", error);
  }

  return {
    confidence: 50,
    riskLevel: 'Medium',
    recommendation: 'Unable to generate prediction',
    explanation: 'Error occurred while analyzing the job'
  };
}

export async function getWorkCenterPrediction(workCenter: any, jobs: any[]): Promise<AIPrediction> {
  try {
    const workCenterJobs = jobs.filter(job => 
      job.work_center === workCenter.name && 
      (job.status === "In Progress" || job.status === "New")
    );

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an expert in manufacturing and production forecasting. Analyze the work center data and provide predictions about workload, bottlenecks, and recommendations."
        },
        {
          role: "user",
          content: `Analyze this work center:
          Name: ${workCenter.name}
          Current Jobs: ${workCenterJobs.length}
          Jobs Details: ${JSON.stringify(workCenterJobs)}
          
          Provide a prediction with:
          1. Confidence score (0-100)
          2. Risk level (Low/Medium/High)
          3. Recommendation
          4. Explanation
          
          Format the response as a JSON object with these exact keys:
          {
              "confidence": number,
              "riskLevel": string,
              "recommendation": string,
              "explanation": string
          }`
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    const response = completion.choices[0]?.message?.content;
    if (response) {
      return JSON.parse(response);
    }
  } catch (error) {
    console.error("Error getting work center prediction:", error);
  }

  return {
    confidence: 50,
    riskLevel: 'Medium',
    recommendation: 'Unable to generate prediction',
    explanation: 'Error occurred while analyzing the work center'
  };
} 