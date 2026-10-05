export interface SkillCategory {
  category: string;
  skills: string[];
}

export const SKILLS_TAXONOMY: SkillCategory[] = [
  {
    category: 'Programming Languages',
    skills: [
      'TypeScript', 'JavaScript', 'Python', 'Go', 'Rust', 'C++', 'Java', 
      'C#', 'Ruby', 'PHP', 'Swift', 'Kotlin', 'SQL', 'Bash', 'HTML/CSS'
    ]
  },
  {
    category: 'Frameworks & Libraries',
    skills: [
      'React', 'Next.js', 'Vue.js', 'Angular', 'Node.js', 'Express', 'Django', 
      'FastAPI', 'Spring Boot', 'Tailwind CSS', 'GraphQL', 'Redux', 'TanStack Query',
      'Gin', 'Actix Web'
    ]
  },
  {
    category: 'Cloud & Infrastructure',
    skills: [
      'AWS', 'Google Cloud (GCP)', 'Azure', 'Kubernetes', 'Docker', 'Terraform', 
      'Cloudflare', 'Serverless', 'Linux', 'Helm', 'CI/CD', 'GitHub Actions'
    ]
  },
  {
    category: 'Databases & Storage',
    skills: [
      'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch', 'Supabase', 
      'DynamoDB', 'SQLite', 'Prisma', 'Drizzle ORM', 'Cassandra', 'Kafka'
    ]
  },
  {
    category: 'Architecture & Practices',
    skills: [
      'Microservices', 'RESTful APIs', 'gRPC', 'Event-Driven Architecture', 
      'Distributed Systems', 'Zero-Trust Architecture', 'TDD', 'Agile/Scrum',
      'Performance Optimization', 'OAuth 2.0', 'Observability (Prometheus/Grafana)'
    ]
  },
  {
    category: 'AI & Data Engineering',
    skills: [
      'Gemini API', 'LLM Prompt Engineering', 'LangChain', 'RAG (Retrieval-Augmented Generation)',
      'Vector Search (pgvector)', 'PyTorch', 'TensorFlow', 'Pandas', 'Spark', 'Airflow'
    ]
  }
];

export const ALL_SKILLS = Array.from(new Set(SKILLS_TAXONOMY.flatMap(c => c.skills)));
