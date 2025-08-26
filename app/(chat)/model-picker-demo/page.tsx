import { auth } from '@/app/(auth)/auth';
import { ModelPicker } from '@/components/model-picker';
import { redirect } from 'next/navigation';

export default async function ModelPickerDemo() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">Enhanced Model Picker</h1>
          <p className="text-muted-foreground">
            Experience the new card-based model selection interface
          </p>
        </div>

        <div className="flex justify-center">
          <ModelPicker
            session={session}
            selectedModelId="xai/grok-3-mini"
            className="w-full max-w-sm"
          />
        </div>

        <div className="bg-muted/50 rounded-lg p-6 space-y-4">
          <h2 className="text-xl font-semibold">Two-State Design</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium mb-2">Compact View</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <span className="size-2 bg-blue-500 rounded-full" />
                  Quick access to favorites + top models
                </li>
                <li className="flex items-center gap-2">
                  <span className="size-2 bg-blue-500 rounded-full" />
                  Smaller dialog (max-w-2xl)
                </li>
                <li className="flex items-center gap-2">
                  <span className="size-2 bg-blue-500 rounded-full" />
                  Up to 8 most relevant models
                </li>
                <li className="flex items-center gap-2">
                  <span className="size-2 bg-blue-500 rounded-full" />
                  "Show all" button to expand
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium mb-2">Expanded View</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <span className="size-2 bg-green-500 rounded-full" />
                  Search functionality with real-time filtering
                </li>
                <li className="flex items-center gap-2">
                  <span className="size-2 bg-green-500 rounded-full" />
                  Larger dialog (max-w-6xl) with more height
                </li>
                <li className="flex items-center gap-2">
                  <span className="size-2 bg-green-500 rounded-full" />
                  All models organized by favorites/others
                </li>
                <li className="flex items-center gap-2">
                  <span className="size-2 bg-green-500 rounded-full" />
                  "Show less" button to compact
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-border">
            <h3 className="font-medium mb-2">Universal Features</h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <span className="size-2 bg-purple-500 rounded-full" />
                Hover tooltips with detailed model information
              </li>
              <li className="flex items-center gap-2">
                <span className="size-2 bg-blue-500 rounded-full" />🧠
                Reasoning capability indicator (blue brain icon)
              </li>
              <li className="flex items-center gap-2">
                <span className="size-2 bg-purple-500 rounded-full" />
                🖼️ Image analysis support indicator (purple image icon)
              </li>
              <li className="flex items-center gap-2">
                <span className="size-2 bg-green-500 rounded-full" />💻
                Artifact generation support (green code icon)
              </li>
              <li className="flex items-center gap-2">
                <span className="size-2 bg-purple-500 rounded-full" />
                Provider-specific icons and branding
              </li>
              <li className="flex items-center gap-2">
                <span className="size-2 bg-purple-500 rounded-full" />
                Space-efficient design without inline descriptions
              </li>
              <li className="flex items-center gap-2">
                <span className="size-2 bg-purple-500 rounded-full" />
                Favorites system with visual feedback
              </li>
            </ul>
          </div>
        </div>

        <div className="text-center text-sm text-muted-foreground">
          <p>
            Navigate to <code>/model-picker-demo</code> to test the new
            interface
          </p>
        </div>
      </div>
    </div>
  );
}
