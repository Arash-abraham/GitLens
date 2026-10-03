interface Props {
    title: string
    description: string
  }
  
  export default function PlaceholderPage({ title, description }: Props) {
    return (
      <div className="p-6 animate-fade-in-up">
        <h1 className="text-2xl font-bold mb-1">{title}</h1>
        <p className="text-sm text-text-muted mb-8">{description}</p>
        <div className="bg-dark-200 border border-dashed border-dark-400 rounded-xl p-12 text-center">
          <p className="text-text-muted">Coming in next iteration</p>
        </div>
      </div>
    )
  }