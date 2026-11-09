import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const service = vi.hoisted(() => ({
  deleteMailDrafts: vi.fn(),
  getMailConversation: vi.fn(),
  getMailCounts: vi.fn(),
  list: vi.fn(),
  listMail: vi.fn(),
  listMailDrafts: vi.fn(),
  markAllInboxRead: vi.fn(),
  markMailRead: vi.fn(),
  markMailUnread: vi.fn(),
  provision: vi.fn(),
  restoreMail: vi.fn(),
  revoke: vi.fn(),
  searchMail: vi.fn(),
  setMailStarred: vi.fn(),
  trashMail: vi.fn(),
}));
vi.mock('@/services/agentAccount', () => ({ agentAccountService: service }));

const surface = vi.hoisted(() => ({ mobile: false }));
vi.mock('@/utils/mobileSurface', () => ({ isMobileSurface: () => surface.mobile }));

vi.mock('@/store/serverConfig', () => ({
  useServerConfigStore: (selector: (state: unknown) => unknown) =>
    selector({ serverConfig: { agentIdentityProviders: ['agent-mail'] } }),
}));
vi.mock('@/features/NavHeader', () => ({ default: () => null }));
vi.mock('@/features/AgentBreadcrumb', () => ({ default: () => null }));
vi.mock('@/features/AgentProfileTabs', () => ({
  AGENT_PROFILE_TABS_CENTER_STYLE: {},
  default: () => null,
}));
vi.mock('@/features/WideScreenContainer', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));

const ui = vi.hoisted(() => ({
  confirmModal: vi.fn(),
  createModal: vi.fn(() => ({ close: vi.fn() })),
}));
vi.mock('@lobehub/ui', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  confirmModal: ui.confirmModal,
  createModal: ui.createModal,
  toast: toastApi,
  DropdownMenu: ({
    children,
    items,
  }: {
    children: React.ReactNode;
    items: { key?: string; label?: string; onClick?: () => void }[];
  }) => (
    <div>
      {children}
      {items
        .filter((item) => item.key)
        .map((item) => (
          <button key={item.key} onClick={item.onClick}>
            {`menu:${item.label}`}
          </button>
        ))}
    </div>
  ),
}));

const toastApi = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(() => ({ close: vi.fn() })),
}));

const { default: AgentMail } = await import('./index');
const { default: AddMailboxForm } = await import('./AddMailboxForm');
const { IDENTITY_CHANNELS } = await import('./const');

const account = (id: string, identifier: string) => ({
  agentId: 'agt_1',
  capabilities: { receive: true, send: true },
  displayName: null,
  id,
  identifier,
  kind: 'mail',
  provider: 'agent-mail',
  status: 'active',
});

const row = (id: string, subject: string, extra: Record<string, unknown> = {}) => ({
  accountId: id === 'msg_b' ? 'acc_b' : 'acc_a',
  agentId: 'agt_1',
  direction: 'inbound',
  fromAddress: `${id}@x.com`,
  fromName: null,
  hasAttachments: false,
  id,
  isStarred: false,
  isUnread: true,
  mailCount: 1,
  preview: `preview of ${subject}`,
  sortAt: new Date(),
  subject,
  threadKey: null,
  to: [{ address: 'a@lobe.id' }],
  trashedAt: null,
  ...extra,
});

const mail = (id: string, extra: Record<string, unknown> = {}) => ({
  accountId: 'acc_a',
  agentId: 'agt_1',
  attachments: [],
  codes: [],
  createdAt: new Date(),
  deliveredAt: new Date(),
  fromAddress: `${id}@x.com`,
  fromName: null,
  id,
  isUnread: true,
  subject: 'Opened',
  text: `Full body of ${id}`,
  threadKey: null,
  to: [{ address: 'agent@lobe.id' }],
  ...extra,
});

const page = (path = '/agent/agt_1/mail') =>
  render(
    <SWRConfig value={{ dedupingInterval: 0, provider: () => new Map() }}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<AgentMail agentId={'agt_1'} />} path={'/agent/:aid/mail/:messageId?'} />
        </Routes>
      </MemoryRouter>
    </SWRConfig>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  surface.mobile = false;
  service.list.mockResolvedValue([account('acc_a', 'a@lobe.id'), account('acc_b', 'b@lobe.id')]);
  service.listMail.mockImplementation(async ({ accountId }: { accountId?: string }) =>
    accountId === 'acc_b' ? [row('msg_b', 'For B')] : [row('msg_a', 'For A')],
  );
  service.listMailDrafts.mockResolvedValue([]);
  service.searchMail.mockResolvedValue([row('msg_hit', 'Search hit')]);
  service.getMailCounts.mockResolvedValue({ drafts: 0, unread: 1 });
  service.markMailRead.mockResolvedValue({ count: 1 });
  service.markMailUnread.mockResolvedValue({ count: 1 });
  service.setMailStarred.mockResolvedValue({ count: 1 });
  service.trashMail.mockResolvedValue({ count: 1, ids: ['msg_a'] });
  service.restoreMail.mockResolvedValue({ count: 1 });
  service.getMailConversation.mockImplementation(async ({ id }: { id: string }) => [mail(id)]);
});

describe('AgentMail', () => {
  it('leaves mail unread until the reader picks a message', async () => {
    page();

    await screen.findByText('preview of For A');

    expect(service.getMailConversation).not.toHaveBeenCalled();
    expect(service.markMailRead).not.toHaveBeenCalled();
  });

  it('reads a picked message beside the list, without a modal', async () => {
    page();

    fireEvent.click(await screen.findByRole('button', { name: 'msg_a@x.com — For A' }));

    expect(await screen.findByText('Full body of msg_a')).toBeInTheDocument();
    expect(ui.createModal).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'msg_a@x.com — For A' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(service.markMailRead).toHaveBeenCalledWith({
      conversationIn: 'inbox',
      ids: ['msg_a'],
    });
  });

  it('switches the list, the count and the open message to the chosen mailbox', async () => {
    page('/agent/agt_1/mail/msg_a');
    expect(await screen.findByText('Full body of msg_a')).toBeInTheDocument();

    fireEvent.click(await screen.findByText(/menu:b@lobe.id/));

    expect(await screen.findByText('preview of For B')).toBeInTheDocument();
    expect(screen.queryByText('preview of For A')).not.toBeInTheDocument();
    expect(screen.queryByText('Full body of msg_a')).not.toBeInTheDocument();
    expect(service.getMailCounts).toHaveBeenCalledWith({ accountId: 'acc_b', agentId: 'agt_1' });
  });

  it('restores the mailbox of a message opened straight from its URL', async () => {
    service.getMailConversation.mockResolvedValue([mail('msg_b', { accountId: 'acc_b' })]);
    page('/agent/agt_1/mail/msg_b');

    expect(await screen.findByText('preview of For B')).toBeInTheDocument();
    expect(screen.queryByText('preview of For A')).not.toBeInTheDocument();
    expect(service.listMail).not.toHaveBeenCalledWith(
      expect.objectContaining({ accountId: 'acc_a' }),
    );
  });

  it('marks a message read when it is opened straight from its URL', async () => {
    page('/agent/agt_1/mail/msg_a');

    expect(await screen.findByText('Full body of msg_a')).toBeInTheDocument();
    await waitFor(() => expect(service.markMailRead).toHaveBeenCalledWith({ ids: ['msg_a'] }));
    expect(service.markMailRead).toHaveBeenCalledTimes(1);
    // The list and count load after the mark, so neither shows it as unread.
    expect(service.markMailRead.mock.invocationCallOrder[0]).toBeLessThan(
      service.listMail.mock.invocationCallOrder[0],
    );
  });

  it('does not re-stamp a read message opened from its URL', async () => {
    service.getMailConversation.mockResolvedValue([mail('msg_a', { isUnread: false })]);
    page('/agent/agt_1/mail/msg_a');

    expect(await screen.findByText('Full body of msg_a')).toBeInTheDocument();
    expect(service.markMailRead).not.toHaveBeenCalled();
  });

  it('asks for confirmation before releasing the mailbox on screen', async () => {
    page();

    fireEvent.click(await screen.findByText('menu:identity.release'));

    expect(ui.confirmModal).toHaveBeenCalledTimes(1);
  });

  it('moves off the open message once its mailbox is released', async () => {
    service.revoke.mockResolvedValue({});
    page('/agent/agt_1/mail/msg_a');
    expect(await screen.findByText('Full body of msg_a')).toBeInTheDocument();

    fireEvent.click(await screen.findByText('menu:identity.release'));
    const [{ onOk }] = ui.confirmModal.mock.calls[0] as unknown as [{ onOk: () => Promise<void> }];
    await onOk();

    expect(service.revoke).toHaveBeenCalledWith('acc_a');
    expect(await screen.findByText('preview of For B')).toBeInTheDocument();
    expect(screen.queryByText('Full body of msg_a')).not.toBeInTheDocument();
  });

  it('adds another mailbox through a dialog', async () => {
    page();

    fireEvent.click(await screen.findByText('menu:identity.add'));

    expect(ui.createModal).toHaveBeenCalledTimes(1);
  });

  it('offers to open an address when the agent has none', async () => {
    service.list.mockResolvedValue([]);
    service.listMail.mockResolvedValue([]);
    page();

    expect(await screen.findByText('identity.provision')).toBeInTheDocument();
    expect(screen.queryByText('menu:identity.release')).not.toBeInTheDocument();
  });

  it('keeps the mailbox on screen when a later refresh fails', async () => {
    service.list
      .mockResolvedValueOnce([account('acc_user', 'me@example.com')])
      .mockRejectedValue(new Error('network down'));
    render(
      <SWRConfig value={{ dedupingInterval: 0, provider: () => new Map(), refreshInterval: 20 }}>
        <MemoryRouter initialEntries={['/agent/agt_1/mail']}>
          <Routes>
            <Route
              element={<AgentMail agentId={'agt_1'} />}
              path={'/agent/:aid/mail/:messageId?'}
            />
          </Routes>
        </MemoryRouter>
      </SWRConfig>,
    );

    expect(await screen.findByText('me@example.com')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('identity.loadFailed')).toBeInTheDocument());
    expect(screen.getByText('me@example.com')).toBeInTheDocument();
  });

  it('gives a message its own page on a phone, and no modal', async () => {
    surface.mobile = true;
    page();

    fireEvent.click(await screen.findByRole('button', { name: 'msg_a@x.com — For A' }));

    expect(await screen.findByText('Full body of msg_a')).toBeInTheDocument();
    expect(ui.createModal).not.toHaveBeenCalled();
  });
});

describe('AgentMail list', () => {
  const firstRow = () => screen.findByRole('button', { name: 'msg_a@x.com — For A' });
  const within = async (label: string) =>
    (await firstRow()).querySelector(`[aria-label="${label}"]`) as HTMLElement;

  it('lists the view named in the URL', async () => {
    service.listMail.mockResolvedValue([row('msg_s', 'Sent one', { direction: 'outbound' })]);
    page('/agent/agt_1/mail?folder=sent');

    expect(await screen.findByText('preview of Sent one')).toBeInTheDocument();
    expect(service.listMail).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: 'acc_a', folder: 'sent' }),
    );
  });

  it('searches from the URL and tells no results from a failure', async () => {
    service.searchMail.mockResolvedValueOnce([]);
    page('/agent/agt_1/mail?q=nothing');

    expect(await screen.findByText('identity.mailbox.search.empty')).toBeInTheDocument();
    expect(screen.queryByText('identity.mailbox.search.failed')).not.toBeInTheDocument();
  });

  it('shows a failed view as a failure, never as empty', async () => {
    service.listMail.mockRejectedValue(new Error('down'));
    page();

    expect(await screen.findByText('identity.mailbox.loadFailed')).toBeInTheDocument();
    expect(screen.queryByText('identity.mailbox.empty.inbox')).not.toBeInTheDocument();
  });

  it('removes a trashed row at once and undoes exactly what was trashed', async () => {
    page();

    fireEvent.click(await within('identity.mailbox.action.delete'));

    await waitFor(() => expect(screen.queryByText('preview of For A')).not.toBeInTheDocument());
    const [options] = toastApi.success.mock.calls[0] as unknown as [
      { actions: { onClick: () => void }[] },
    ];
    options.actions[0].onClick();
    await waitFor(() => expect(service.restoreMail).toHaveBeenCalledWith({ ids: ['msg_a'] }));
  });

  it('rolls a failed star back and offers a retry', async () => {
    service.setMailStarred.mockRejectedValue(new Error('nope'));
    page();

    fireEvent.click(await within('identity.mailbox.action.star'));

    await waitFor(() => expect(toastApi.error).toHaveBeenCalledTimes(1));
    expect(await within('identity.mailbox.action.star')).toBeInTheDocument();
    expect(toastApi.error.mock.calls[0][0]).toMatchObject({
      actions: [{ label: 'identity.mailbox.retry' }],
      title: 'identity.mailbox.failed.star',
    });
  });

  it('shows the bulk toolbar once a row is selected, and clears it after acting', async () => {
    page();

    const box = (await firstRow()).querySelector('[role="checkbox"]')!;
    fireEvent.click(box.parentElement!);

    expect(await screen.findByText('identity.mailbox.bulk.selected')).toBeInTheDocument();
    // The toolbar sits above the rows, so its button comes first.
    fireEvent.click(screen.getAllByRole('button', { name: 'identity.mailbox.action.markRead' })[0]);

    await waitFor(() =>
      expect(service.markMailRead).toHaveBeenCalledWith({
        conversationIn: 'inbox',
        ids: ['msg_a'],
      }),
    );
    await waitFor(() =>
      expect(screen.queryByText('identity.mailbox.bulk.selected')).not.toBeInTheDocument(),
    );
  });
});

describe('AddMailboxForm', () => {
  const setup = () => {
    const onAdded = vi.fn();
    render(
      <AddMailboxForm
        agentId={'agt_1'}
        channel={IDENTITY_CHANNELS[0]}
        onAdded={onAdded}
        onChanged={vi.fn()}
      />,
    );
    return onAdded;
  };

  it('shows the fixed domain and waits for a prefix', () => {
    setup();

    expect(screen.getByText('@lobe.id')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'identity.provision' })).toBeDisabled();
  });

  it('opens the mailbox for the typed prefix and reports it', async () => {
    const issued = account('acc_new', 'growth@lobe.id');
    service.provision.mockResolvedValue(issued);
    const onAdded = setup();

    fireEvent.change(screen.getByPlaceholderText('identity.prefix.required'), {
      target: { value: 'growth' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'identity.provision' }));

    await waitFor(() => expect(onAdded).toHaveBeenCalledWith(issued));
    expect(service.provision).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: 'agt_1', prefix: 'growth', provider: 'agent-mail' }),
    );
  });
});
