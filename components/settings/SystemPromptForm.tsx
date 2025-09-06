'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useModels } from '@/hooks/use-models';
import { SYSTEM_PROMPT_LIMITS } from '@/lib/validations';
import { X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

interface SystemPromptFormProps {
  className?: string;
}

export function SystemPromptForm({ className }: SystemPromptFormProps) {
  const { systemPrompt, mutate } = useModels();

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    profession: '',
    traits: [] as string[],
    preferences: '',
  });

  const [newTrait, setNewTrait] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize form data from system prompt
  useEffect(() => {
    if (systemPrompt) {
      setFormData({
        name: systemPrompt.name || '',
        profession: systemPrompt.profession || '',
        traits: systemPrompt.traits || [],
        preferences: systemPrompt.preferences || '',
      });
    }
  }, [systemPrompt]);

  // Track changes
  useEffect(() => {
    const originalData = {
      name: systemPrompt?.name || '',
      profession: systemPrompt?.profession || '',
      traits: systemPrompt?.traits || [],
      preferences: systemPrompt?.preferences || '',
    };

    const hasChanged =
      formData.name !== originalData.name ||
      formData.profession !== originalData.profession ||
      JSON.stringify(formData.traits) !== JSON.stringify(originalData.traits) ||
      formData.preferences !== originalData.preferences;

    setHasChanges(hasChanged);
  }, [formData, systemPrompt]);

  const handleInputChange = useCallback((field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleAddTrait = useCallback(() => {
    if (!newTrait.trim()) return;

    if (newTrait.length > SYSTEM_PROMPT_LIMITS.TRAIT_MAX_LENGTH) {
      toast.error(
        `Trait must be ${SYSTEM_PROMPT_LIMITS.TRAIT_MAX_LENGTH} characters or less`,
      );
      return;
    }

    if (formData.traits.length >= SYSTEM_PROMPT_LIMITS.TRAITS_MAX_COUNT) {
      toast.error(
        `Maximum ${SYSTEM_PROMPT_LIMITS.TRAITS_MAX_COUNT} traits allowed`,
      );
      return;
    }

    if (formData.traits.includes(newTrait.trim())) {
      toast.error('This trait already exists');
      return;
    }

    setFormData((prev) => ({
      ...prev,
      traits: [...prev.traits, newTrait.trim()],
    }));
    setNewTrait('');
  }, [newTrait, formData.traits]);

  const handleRemoveTrait = useCallback((index: number) => {
    setFormData((prev) => ({
      ...prev,
      traits: prev.traits.filter((_, i) => i !== index),
    }));
  }, []);

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddTrait();
      }
    },
    [handleAddTrait],
  );

  const handleSave = async () => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/user/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          systemPrompt: {
            ...formData,
            updatedAt: new Date().toISOString(),
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save system prompt');
      }

      // Refresh the models data to get updated system prompt
      await mutate();

      toast.success('System prompt saved successfully!');
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save system prompt:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to save system prompt',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    if (systemPrompt) {
      setFormData({
        name: systemPrompt.name || '',
        profession: systemPrompt.profession || '',
        traits: systemPrompt.traits || [],
        preferences: systemPrompt.preferences || '',
      });
    } else {
      setFormData({
        name: '',
        profession: '',
        traits: [],
        preferences: '',
      });
    }
    setHasChanges(false);
  };

  return (
    <Card className={className}>
      <CardContent className="space-y-6">
        {/* Name Field */}
        <div className="space-y-2">
          <Label htmlFor="name">Your Name (Optional)</Label>
          <Input
            id="name"
            placeholder="How should the AI address you?"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            maxLength={SYSTEM_PROMPT_LIMITS.NAME_MAX}
          />
          <p className="text-xs text-muted-foreground">
            {formData.name.length}/{SYSTEM_PROMPT_LIMITS.NAME_MAX} characters
          </p>
        </div>

        {/* Profession Field */}
        <div className="space-y-2">
          <Label htmlFor="profession">What You Do (Optional)</Label>
          <Input
            id="profession"
            placeholder="e.g., Software Engineer, Teacher, Student"
            value={formData.profession}
            onChange={(e) => handleInputChange('profession', e.target.value)}
            maxLength={SYSTEM_PROMPT_LIMITS.PROFESSION_MAX}
          />
          <p className="text-xs text-muted-foreground">
            {formData.profession.length}/{SYSTEM_PROMPT_LIMITS.PROFESSION_MAX}{' '}
            characters
          </p>
        </div>

        {/* Traits Field */}
        <div className="space-y-2">
          <Label htmlFor="traits">Personality Traits (Optional)</Label>
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                id="traits"
                placeholder="Add a personality trait..."
                value={newTrait}
                onChange={(e) => setNewTrait(e.target.value)}
                onKeyPress={handleKeyPress}
                maxLength={SYSTEM_PROMPT_LIMITS.TRAIT_MAX_LENGTH}
              />
              <Button
                type="button"
                onClick={handleAddTrait}
                disabled={
                  !newTrait.trim() ||
                  formData.traits.length >=
                    SYSTEM_PROMPT_LIMITS.TRAITS_MAX_COUNT
                }
                size="sm"
              >
                Add
              </Button>
            </div>

            {/* Traits Display */}
            {formData.traits.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.traits.map((trait, index) => (
                  <div
                    key={trait}
                    className="flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-1 rounded-md text-sm"
                  >
                    <span>{trait}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTrait(index)}
                      className="hover:text-destructive"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              {formData.traits.length}/{SYSTEM_PROMPT_LIMITS.TRAITS_MAX_COUNT}{' '}
              traits
              {newTrait &&
                ` • ${newTrait.length}/${SYSTEM_PROMPT_LIMITS.TRAIT_MAX_LENGTH} characters`}
            </p>
          </div>
        </div>

        {/* Preferences Field */}
        <div className="space-y-2">
          <Label htmlFor="preferences">
            How You Want the AI to Act (Optional)
          </Label>
          <Textarea
            id="preferences"
            placeholder="Describe how you want the AI to communicate with you, what style to use, what to focus on, etc."
            value={formData.preferences}
            onChange={(e) => handleInputChange('preferences', e.target.value)}
            maxLength={SYSTEM_PROMPT_LIMITS.PREFERENCES_MAX}
            rows={4}
            className="resize-none"
          />
          <p className="text-xs text-muted-foreground">
            {formData.preferences.length}/{SYSTEM_PROMPT_LIMITS.PREFERENCES_MAX}{' '}
            characters
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4">
          <Button
            onClick={handleSave}
            disabled={!hasChanges || isLoading}
            className="flex-1"
          >
            {isLoading ? 'Saving...' : 'Save Changes'}
          </Button>
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={!hasChanges || isLoading}
          >
            Reset
          </Button>
        </div>

        {/* Help Text */}
        <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
          <p className="font-medium mb-1">
            💡 Tips for better AI interactions:
          </p>
          <ul className="space-y-1 list-disc list-inside">
            <li>Be specific about your communication preferences</li>
            <li>Mention your expertise level in relevant topics</li>
            <li>Include any specific formats or styles you prefer</li>
            <li>These settings apply to all AI models in compare mode</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
