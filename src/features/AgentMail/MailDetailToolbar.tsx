'use client';

import { ActionIcon, Flexbox } from '@lobehub/ui';
import { ChevronDown, ChevronUp, Forward, Mail, MailOpen, Reply, Star, Trash2 } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { identityStyles } from './styles';

export interface MailDetailToolbarProps {
  hasNext: boolean;
  hasPrevious: boolean;
  onForward?: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onReply?: () => void;
  onToggleRead?: () => void;
  onToggleStar?: () => void;
  onTrash?: () => void;
  starred: boolean;
  unread: boolean;
}

/** What can be done to the open conversation, and the way to the ones around it. */
const MailDetailToolbar = memo<MailDetailToolbarProps>(
  ({
    hasNext,
    hasPrevious,
    onForward,
    onNext,
    onPrevious,
    onReply,
    onToggleRead,
    onToggleStar,
    onTrash,
    starred,
    unread,
  }) => {
    const { t } = useTranslation('setting');

    return (
      <Flexbox
        horizontal
        align={'center'}
        className={identityStyles.mailToolbar}
        data-testid={'mail-toolbar'}
        justify={'space-between'}
      >
        <Flexbox horizontal gap={4}>
          {onReply && (
            <ActionIcon
              aria-label={t('identity.inbox.action.reply')}
              data-testid={'mail-action-reply'}
              icon={Reply}
              title={t('identity.inbox.action.reply')}
              onClick={onReply}
            />
          )}
          {onForward && (
            <ActionIcon
              aria-label={t('identity.inbox.action.forward')}
              data-testid={'mail-action-forward'}
              icon={Forward}
              title={t('identity.inbox.action.forward')}
              onClick={onForward}
            />
          )}
          {onTrash && (
            <ActionIcon
              aria-label={t('identity.inbox.action.trash')}
              data-testid={'mail-action-trash'}
              icon={Trash2}
              title={t('identity.inbox.action.trash')}
              onClick={onTrash}
            />
          )}
          {onToggleStar && (
            <ActionIcon
              active={starred}
              aria-pressed={starred}
              data-testid={'mail-action-star'}
              icon={Star}
              title={t(starred ? 'identity.inbox.action.unstar' : 'identity.inbox.action.star')}
              aria-label={t(
                starred ? 'identity.inbox.action.unstar' : 'identity.inbox.action.star',
              )}
              onClick={onToggleStar}
            />
          )}
          {onToggleRead && (
            <ActionIcon
              data-testid={'mail-action-unread'}
              data-unread={unread}
              icon={unread ? MailOpen : Mail}
              aria-label={t(
                unread ? 'identity.inbox.action.markRead' : 'identity.inbox.action.markUnread',
              )}
              title={t(
                unread ? 'identity.inbox.action.markRead' : 'identity.inbox.action.markUnread',
              )}
              onClick={onToggleRead}
            />
          )}
        </Flexbox>
        <Flexbox horizontal gap={4}>
          <ActionIcon
            aria-label={t('identity.inbox.action.previous')}
            data-testid={'mail-nav-previous'}
            disabled={!hasPrevious}
            icon={ChevronUp}
            title={t('identity.inbox.action.previous')}
            onClick={onPrevious}
          />
          <ActionIcon
            aria-label={t('identity.inbox.action.next')}
            data-testid={'mail-nav-next'}
            disabled={!hasNext}
            icon={ChevronDown}
            title={t('identity.inbox.action.next')}
            onClick={onNext}
          />
        </Flexbox>
      </Flexbox>
    );
  },
);

MailDetailToolbar.displayName = 'AgentMailDetailToolbar';

export default MailDetailToolbar;
