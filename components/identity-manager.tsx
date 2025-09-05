/**
 * Identity Manager Component
 *
 * Allows users to view and manage their linked authentication identities
 * Supports multiple OAuth providers and account linking/unlinking
 */

'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useSupabaseAuth } from '@/hooks/use-supabase-auth';
import {
  Github,
  Loader2,
  Mail,
  Plus,
  Shield,
  Trash2,
  Twitter,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface Identity {
  id: string;
  user_id: string;
  identity_id: string;
  provider: string;
  provider_id: string;
  created_at: string;
  last_sign_in_at: string;
  updated_at: string;
}

export function IdentityManager() {
  const {
    user,
    loading,
    getLinkedIdentities,
    linkIdentity,
    unlinkIdentity,
    isAuthenticated,
    isAnonymous,
  } = useSupabaseAuth();

  const [identities, setIdentities] = useState<Identity[]>([]);
  const [loadingIdentities, setLoadingIdentities] = useState(false);
  const [linkingProvider, setLinkingProvider] = useState<string | null>(null);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);

  // Load identities on mount and when user changes
  useEffect(() => {
    if (isAuthenticated && !isAnonymous) {
      loadIdentities();
    }
  }, [isAuthenticated, isAnonymous]);

  const loadIdentities = async () => {
    setLoadingIdentities(true);
    try {
      const { identities: userIdentities, error } = await getLinkedIdentities();
      if (error) {
        toast.error('Failed to load linked accounts');
        return;
      }
      setIdentities(userIdentities as Identity[]);
    } catch (err) {
      console.error('Failed to load identities:', err);
    } finally {
      setLoadingIdentities(false);
    }
  };

  const handleLinkIdentity = async (
    provider: 'google' | 'github' | 'discord' | 'twitter',
  ) => {
    setLinkingProvider(provider);
    try {
      const { error } = await linkIdentity(provider);
      if (error) {
        toast.error(`Failed to link ${provider} account`);
        return;
      }

      // Reload identities to show the new link
      await loadIdentities();

      toast.success(`${provider} account linked successfully`);
    } catch (err) {
      console.error(`Failed to link ${provider}:`, err);
    } finally {
      setLinkingProvider(null);
    }
  };

  const handleUnlinkIdentity = async (identityId: string, provider: string) => {
    // Don't allow unlinking if it's the last identity
    if (identities.length <= 1) {
      toast.error('You must have at least one linked account');
      return;
    }

    setUnlinkingId(identityId);
    try {
      const { error } = await unlinkIdentity(identityId);
      if (error) {
        toast.error(`Failed to unlink ${provider} account`);
        return;
      }

      // Reload identities to reflect the change
      await loadIdentities();

      toast.success(`${provider} account unlinked successfully`);
    } catch (err) {
      console.error(`Failed to unlink ${provider}:`, err);
    } finally {
      setUnlinkingId(null);
    }
  };

  const getProviderIcon = (provider: string) => {
    switch (provider.toLowerCase()) {
      case 'google':
        return <Shield className="h-4 w-4 text-red-500" />;
      case 'github':
        return <Github className="h-4 w-4" />;
      case 'twitter':
        return <Twitter className="h-4 w-4 text-blue-500" />;
      case 'email':
        return <Mail className="h-4 w-4" />;
      default:
        return <Shield className="h-4 w-4" />;
    }
  };

  const getProviderColor = (provider: string) => {
    switch (provider.toLowerCase()) {
      case 'google':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'github':
        return 'bg-gray-50 text-gray-700 border-gray-200';
      case 'twitter':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'email':
        return 'bg-green-50 text-green-700 border-green-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isAuthenticated) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Account Management</CardTitle>
          <CardDescription>
            Sign in to manage your linked accounts and authentication methods.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (isAnonymous) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Link Your Accounts</CardTitle>
          <CardDescription>
            Link your social accounts to access advanced features and never lose
            your data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button
              onClick={() => handleLinkIdentity('google')}
              disabled={linkingProvider !== null}
              className="w-full"
            >
              {linkingProvider === 'google' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Shield className="mr-2 h-4 w-4" />
              )}
              Link Google Account
            </Button>
            <Button
              variant="outline"
              onClick={() => handleLinkIdentity('github')}
              disabled={linkingProvider !== null}
              className="w-full"
            >
              {linkingProvider === 'github' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Github className="mr-2 h-4 w-4" />
              )}
              Link GitHub Account
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Linked Accounts</CardTitle>
        <CardDescription>
          Manage your authentication methods and linked social accounts.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Identities */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium">Your Linked Accounts</h3>

          {loadingIdentities ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : identities.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No linked accounts found.
            </p>
          ) : (
            <div className="space-y-3">
              {identities.map((identity) => (
                <div
                  key={identity.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    {getProviderIcon(identity.provider)}
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium capitalize">
                          {identity.provider}
                        </span>
                        <Badge
                          variant="secondary"
                          className={getProviderColor(identity.provider)}
                        >
                          {identity.provider}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Linked {formatDate(identity.created_at)}
                        {identity.last_sign_in_at && (
                          <span className="ml-2">
                            • Last sign-in{' '}
                            {formatDate(identity.last_sign_in_at)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {identities.length > 1 && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={unlinkingId === identity.id}
                        >
                          {unlinkingId === identity.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Unlink Account</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to unlink your{' '}
                            {identity.provider} account? You can always link it
                            again later.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() =>
                              handleUnlinkIdentity(
                                identity.id,
                                identity.provider,
                              )
                            }
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Unlink Account
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Add New Identity */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium">Link New Account</h3>
          <div className="grid grid-cols-2 gap-3">
            {!identities.some((id) => id.provider === 'google') && (
              <Button
                variant="outline"
                onClick={() => handleLinkIdentity('google')}
                disabled={linkingProvider !== null}
                className="flex items-center space-x-2"
              >
                {linkingProvider === 'google' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Shield className="h-4 w-4 text-red-500" />
                )}
                <span>Google</span>
              </Button>
            )}

            {!identities.some((id) => id.provider === 'github') && (
              <Button
                variant="outline"
                onClick={() => handleLinkIdentity('github')}
                disabled={linkingProvider !== null}
                className="flex items-center space-x-2"
              >
                {linkingProvider === 'github' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Github className="h-4 w-4" />
                )}
                <span>GitHub</span>
              </Button>
            )}

            {!identities.some((id) => id.provider === 'discord') && (
              <Button
                variant="outline"
                onClick={() => handleLinkIdentity('discord')}
                disabled={linkingProvider !== null}
                className="flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>Discord</span>
              </Button>
            )}

            {!identities.some((id) => id.provider === 'twitter') && (
              <Button
                variant="outline"
                onClick={() => handleLinkIdentity('twitter')}
                disabled={linkingProvider !== null}
                className="flex items-center space-x-2"
              >
                <Twitter className="h-4 w-4 text-blue-500" />
                <span>Twitter</span>
              </Button>
            )}
          </div>
        </div>

        {/* Security Note */}
        <div className="bg-muted p-4 rounded-lg">
          <div className="flex items-start space-x-2">
            <Shield className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-muted-foreground">
                Security Information
              </p>
              <p className="text-muted-foreground mt-1">
                Linking multiple accounts provides backup authentication methods
                and makes your account more secure. You can unlink accounts at
                any time, but you'll need at least one linked account to sign
                in.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
