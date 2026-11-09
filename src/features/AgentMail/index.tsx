'use client';

import { Flexbox } from '@lobehub/ui';
import { useParams, useSearchParams } from 'react-router';
import urlJoin from 'url-join';

import AgentBreadcrumb from '@/features/AgentBreadcrumb';
import AgentProfileTabs, { AGENT_PROFILE_TABS_CENTER_STYLE } from '@/features/AgentProfileTabs';
import NavHeader from '@/features/NavHeader';
import WideScreenContainer from '@/features/WideScreenContainer';
import { useWorkspaceAwareNavigate } from '@/features/Workspace/useWorkspaceAwareNavigate';
import { isMobileSurface } from '@/utils/mobileSurface';
import { StyleSheet } from '@/utils/styles';

import InboxMessageDetail from './InboxMessageDetail';
import InboxSection from './InboxSection';
import MailboxCard from './MailboxCard';
import MailSplitView from './MailSplitView';
import { identityStyles } from './styles';
import { useMailbox } from './useAgentIdentity';
import { mailFolderOf, type MailListItem, type MailView, parseMailView } from './useMailList';

const styles = StyleSheet.create({
  body: {
    display: 'flex',
    overflowY: 'auto',
    position: 'relative',
  },
});

interface AgentMailProps {
  agentId: string;
  /** Read-only viewer: addresses and mail stay readable, nothing can be opened or released. */
  disabled?: boolean;
}

/**
 * The agent's mail page: which mailbox is being read, and what has arrived.
 *
 * The open message lives in the URL, so a phone's back gesture leaves it and a
 * reload keeps it. A wide screen shows it beside the list; a phone gives it the
 * whole page.
 */
const MailPage = ({ agentId, disabled }: AgentMailProps) => {
  const { messageId } = useParams<{ messageId?: string }>();
  const navigate = useWorkspaceAwareNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const view = parseMailView(searchParams.get('folder'));
  const query = searchParams.get('q')?.trim() ?? '';
  const folder = query ? undefined : mailFolderOf(view);
  const composeId = searchParams.get('compose') ?? undefined;
  const mailbox = useMailbox(agentId, messageId, folder);
  const mobile = isMobileSurface();
  const mailPath = urlJoin('/agent', agentId, 'mail');
  const search = searchParams.toString();

  // Moving between messages replaces the entry, so back leaves the mail page.
  const openMessage = (item: MailListItem) => {
    if (item.kind === 'draft') {
      navigate(`${mailPath}?folder=drafts&compose=${item.id}`, { replace: true });
      return;
    }
    // Pinned so the opened message does not have to be read to know its mailbox.
    mailbox.select(mailbox.current?.id);
    navigate(`${urlJoin(mailPath, item.id)}${search && `?${search}`}`, {
      replace: Boolean(messageId),
    });
  };

  // The view stays; a search or an open message belongs to the address being left.
  const switchMailbox = (accountId: string) => {
    mailbox.select(accountId);
    navigate(view === 'inbox' ? mailPath : `${mailPath}?folder=${view}`, { replace: true });
  };

  const changeView = (next: MailView) => setSearchParams(next === 'inbox' ? {} : { folder: next });

  const changeQuery = (next: string) =>
    setSearchParams(
      (previous) => {
        const params = new URLSearchParams(previous);
        if (next) params.set('q', next);
        else params.delete('q');
        return params;
      },
      { replace: true },
    );

  const mailboxCard = (
    <MailboxCard agentId={agentId} disabled={disabled} mailbox={mailbox} onSwitch={switchMailbox} />
  );
  // Waits for the mailbox so the list never flashes another address's mail first.
  const inbox = !(mailbox.isLoading && !mailbox.data) && (
    <InboxSection
      accountId={mailbox.current?.id}
      accountIds={mailbox.accounts.map((account) => account.id)}
      agentId={agentId}
      disabled={disabled}
      query={query}
      selectedId={mobile ? undefined : (messageId ?? composeId)}
      view={view}
      onOpen={openMessage}
      onQueryChange={changeQuery}
      onViewChange={changeView}
      onRemoved={(ids) => {
        if (messageId && ids.includes(messageId)) {
          navigate(`${mailPath}${search && `?${search}`}`, { replace: true });
        }
      }}
    />
  );

  return (
    <Flexbox height={'100%'} style={{ position: 'relative' }} width={'100%'}>
      {mobile ? (
        <>
          <NavHeader
            left={<AgentBreadcrumb agentId={agentId} />}
            // `relative` anchors the absolutely-centered switcher below.
            style={{ position: 'relative' }}
            styles={{
              // Center on the header midpoint (equal gaps), not the leftover track.
              center: AGENT_PROFILE_TABS_CENTER_STYLE,
              left: { minWidth: 0, paddingInlineStart: 8 },
            }}
          >
            <AgentProfileTabs active={'mail'} agentId={agentId} />
          </NavHeader>
          <Flexbox flex={1} style={styles.body} width={'100%'}>
            <WideScreenContainer>
              <Flexbox gap={24} paddingBlock={16}>
                {mailboxCard}
                {inbox}
              </Flexbox>
            </WideScreenContainer>
          </Flexbox>
        </>
      ) : (
        <MailSplitView folder={folder} inbox={inbox} mailbox={mailboxCard} messageId={messageId} />
      )}
      {/* Laid over the list instead of replacing it, so back returns to the same scroll. */}
      {mobile && messageId && (
        <Flexbox className={identityStyles.mobileDetail}>
          <NavHeader />
          <Flexbox flex={1} padding={16} style={styles.body} width={'100%'}>
            <InboxMessageDetail folder={folder} id={messageId} />
          </Flexbox>
        </Flexbox>
      )}
    </Flexbox>
  );
};

/** Keyed so a selected mailbox never carries over to another agent. */
const AgentMail = (props: AgentMailProps) => <MailPage key={props.agentId} {...props} />;

export default AgentMail;
