import { useEffect, useState } from 'react';

const apiBase = import.meta.env.VITE_API_URL || '/api';

const views = ['home', 'dashboard', 'community', 'community-post', 'events', 'event-detail', 'admin', 'donate', 'account'];

const communityHighlights = [
  { label: 'Members checking in', value: '1,284' },
  { label: 'This month raised', value: '$84k' },
  { label: 'Open conversations', value: '46' },
];

const communityBoard = [
  {
    id: 1,
    title: 'Harvest table sign-ups open',
    meta: 'Town square • 2 hours ago',
    body: 'Volunteer cooks and growers are coordinating the Sunday meal with fresh produce from local farms.',
  },
  {
    id: 2,
    title: 'New neighbor welcome circle',
    meta: 'Community hall • Today',
    body: 'A relaxed intro session for new residents, families, and anyone wanting to meet the people nearby.',
  },
  {
    id: 3,
    title: 'Tool library update',
    meta: 'Workshop shed • Yesterday',
    body: 'The community tool shelf now includes pruning kits, canvas aprons, and two repaired wheelbarrows.',
  },
];

const upcomingEvents = [
  { id: 1, day: 'Thu 14', title: 'Evening market walk', note: '6:30 PM · Main green', startsAt: '2026-05-14T18:30:00Z' },
  { id: 2, day: 'Sat 16', title: 'Seed swap and coffee', note: '9:00 AM · Community porch', startsAt: '2026-05-16T09:00:00Z' },
  { id: 3, day: 'Mon 18', title: 'Council listening hour', note: '7:00 PM · Hall table', startsAt: '2026-05-18T19:00:00Z' },
];

const supportLevels = [
  { name: 'Neighbor', amount: '$15', detail: 'Helps keep community updates, hosting, and outreach running.' },
  { name: 'Steward', amount: '$50', detail: 'Supports events, shared resources, and local coordination.' },
  { name: 'Anchor', amount: '$100', detail: 'Funds larger community projects and outreach for new families.' },
];

const dashboardActions = [
  'Check community notices',
  'Review this week\'s events',
  'Make a support contribution',
];

const dashboardNotes = [
  'Your member profile stays synced between sessions.',
  'Support payments are processed securely through Stripe.',
  'Community moderators can later add event and post management here.',
];

const defaultProfilePreferences = {
  contactPreference: 'email',
  interests: 'Community updates',
  visibility: 'public',
};

const initialAuth = {
  mode: 'register',
  name: '',
  email: '',
  password: '',
};

const sectionSummaries = {
  home: {
    title: 'A warmer place for neighbors to gather, share, and support one another.',
    copy:
      'Stitch Village is a community home for updates, events, local support, and donations. It is designed to feel calm, welcoming, and easy to use on any screen.',
  },
  dashboard: {
    title: 'Your village workspace',
    copy:
      'A personalized area for member status, quick actions, and the most important community touchpoints in one place.',
  },
  community: {
    title: 'News, notices, and neighbor updates',
    copy:
      'A live notice board for village stories, local updates, and the small things that help people stay connected.',
  },
  'community-post': {
    title: 'Post details',
    copy: 'Open a community post to react, bookmark, and leave a comment in context.',
  },
  events: {
    title: 'What is on this week',
    copy:
      'A simple schedule for gatherings, listening sessions, and community meetups that keep people in the loop.',
  },
  'event-detail': {
    title: 'Event details',
    copy: 'Open an event to RSVP, react, and talk with the people attending.',
  },
  donate: {
    title: 'Make a one-time donation',
    copy:
      'Support gatherings, outreach, and shared resources with a secure Stripe checkout flow backed by PostgreSQL.',
  },
  account: {
    title: 'Account overview',
    copy:
      'Register or sign in to keep your profile synced, manage your access, and return to the hub anytime.',
  },
};

function money(amountCents) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amountCents / 100);
}

function EmptyState({ title, description, actionLabel, onAction }) {
  return (
    <div className="empty-state">
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      {actionLabel && onAction ? (
        <button className="button ghost" type="button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function getInitialView() {
  const route = getRouteFromHash();
  return route.view;
}

function getRouteFromHash() {
  if (typeof window === 'undefined') {
    return { view: 'home', detailId: null };
  }

  const hash = window.location.hash.replace('#', '');
  if (hash.startsWith('community-post')) {
    const parts = hash.split('-');
    return {
      view: 'community-post',
      detailId: parts.length > 2 ? Number(parts[2]) : null,
    };
  }

  if (hash.startsWith('event-detail')) {
    const parts = hash.split('-');
    return {
      view: 'event-detail',
      detailId: parts.length > 2 ? Number(parts[2]) : null,
    };
  }

  return views.includes(hash) ? { view: hash, detailId: null } : { view: 'home', detailId: null };
}

export default function App() {
  const [view, setView] = useState(getInitialView);
  const [auth, setAuth] = useState(initialAuth);
  const [authMessage, setAuthMessage] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [loadingAuth, setLoadingAuth] = useState(false);
  const [loadingPayment, setLoadingPayment] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [token, setToken] = useState(() => localStorage.getItem('token') || '');
  const [user, setUser] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [bookmarkedPosts, setBookmarkedPosts] = useState([]);
  const [rsvpEvents, setRsvpEvents] = useState([]);
  const [payment, setPayment] = useState({ title: 'Village support donation', amount: '25' });
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    contactPreference: defaultProfilePreferences.contactPreference,
    interests: defaultProfilePreferences.interests,
    visibility: defaultProfilePreferences.visibility,
  });
  const [profileMessage, setProfileMessage] = useState('');
  const [homeHighlights, setHomeHighlights] = useState(communityHighlights);
  const [communityPosts, setCommunityPosts] = useState(communityBoard);
  const [eventRows, setEventRows] = useState(upcomingEvents);
  const initialRoute = getRouteFromHash();
  const [selectedPostId, setSelectedPostId] = useState(initialRoute.view === 'community-post' ? initialRoute.detailId : null);
  const [selectedEventId, setSelectedEventId] = useState(initialRoute.view === 'event-detail' ? initialRoute.detailId : null);
  const [selectedPostDetail, setSelectedPostDetail] = useState(null);
  const [selectedEventDetail, setSelectedEventDetail] = useState(null);
  const [postCommentBody, setPostCommentBody] = useState('');
  const [eventCommentBody, setEventCommentBody] = useState('');
  const [pendingPosts, setPendingPosts] = useState([]);
  const [pendingEvents, setPendingEvents] = useState([]);
  const [dashboardContent, setDashboardContent] = useState({
    summary: sectionSummaries.dashboard,
    actions: dashboardActions,
    notes: dashboardNotes,
    member: null,
    roleSections: [],
  });
  const [postEditor, setPostEditor] = useState({ title: '', meta: '', body: '' });
  const [eventEditor, setEventEditor] = useState({ dayLabel: '', title: '', note: '', startsAt: '' });
  const [editingPostId, setEditingPostId] = useState(null);
  const [editingEventId, setEditingEventId] = useState(null);
  const [showPostComposer, setShowPostComposer] = useState(false);
  const [showEventComposer, setShowEventComposer] = useState(false);
  const [toasts, setToasts] = useState([]);

  const isLoggedIn = Boolean(user && token);
  const isAdmin = user?.role === 'admin';
  const currentSummary = sectionSummaries[view] || sectionSummaries.home;
  const isDetailView = view === 'community-post' || view === 'event-detail';

  useEffect(() => {
    const onHashChange = () => {
      const nextRoute = getRouteFromHash();
      setView(nextRoute.view);
      setSelectedPostId(nextRoute.view === 'community-post' ? nextRoute.detailId : null);
      setSelectedEventId(nextRoute.view === 'event-detail' ? nextRoute.detailId : null);
    };

    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    setStatusMessage('');
  }, [view]);

  useEffect(() => {
    if (view !== 'community-post') {
      setSelectedPostId(null);
      setSelectedPostDetail(null);
      setPostCommentBody('');
    }

    if (view !== 'event-detail') {
      setSelectedEventId(null);
      setSelectedEventDetail(null);
      setEventCommentBody('');
    }
  }, [view]);

  useEffect(() => {
    if (!token) {
      setUser(null);
      return;
    }

    const controller = new AbortController();

    fetch(`${apiBase}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Session expired');
        }

        const data = await response.json();
        setUser(data.user);
      })
      .catch(() => {
        localStorage.removeItem('token');
        setToken('');
        setUser(null);
      });

    return () => controller.abort();
  }, [token]);

  useEffect(() => {
    if (user) {
      const preferences = user.preferences || {};
      setProfile((current) => ({
        ...current,
        name: user.name || '',
        email: user.email || '',
        contactPreference: preferences.contactPreference || defaultProfilePreferences.contactPreference,
        interests: preferences.interests || defaultProfilePreferences.interests,
        visibility: preferences.visibility || defaultProfilePreferences.visibility,
      }));
    } else {
      setProfile({
        name: '',
        email: '',
        currentPassword: '',
        newPassword: '',
        contactPreference: defaultProfilePreferences.contactPreference,
        interests: defaultProfilePreferences.interests,
        visibility: defaultProfilePreferences.visibility,
      });
    }
  }, [user]);

  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      fetch(`${apiBase}/content/home`, { signal: controller.signal }).then((response) => response.json()),
      fetch(`${apiBase}/content/community`, { signal: controller.signal }).then((response) => response.json()),
      fetch(`${apiBase}/content/events`, { signal: controller.signal }).then((response) => response.json()),
    ])
      .then(([homeData, communityData, eventData]) => {
        if (homeData?.highlights) {
          setHomeHighlights(homeData.highlights);
        }

        if (communityData?.posts) {
          setCommunityPosts(
            communityData.posts
              .filter((p) => p.status === 'approved' || isAdmin)
              .map((post) => ({
                id: post.id,
                title: post.title,
                meta: post.meta,
                body: post.body,
                bookmarkCount: post.bookmark_count || 0,
              }))
          );
        }

        if (eventData?.events) {
          setEventRows(
            eventData.events
              .filter((e) => e.status === 'approved' || isAdmin)
              .map((event) => ({
                id: event.id,
                day: event.day_label,
                title: event.title,
                note: event.note,
                startsAt: event.starts_at,
                rsvpCount: event.rsvp_count || 0,
              }))
          );
        }
      })
      .catch(() => {
        setHomeHighlights(communityHighlights);
        setCommunityPosts(communityBoard);
        setEventRows(upcomingEvents);
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!token) {
      setDashboardContent({
        summary: sectionSummaries.dashboard,
        actions: dashboardActions,
        notes: dashboardNotes,
        member: null,
        roleSections: [],
      });
      return;
    }

    const controller = new AbortController();

    fetch(`${apiBase}/content/dashboard`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then((response) => response.json())
      .then((data) => {
        setDashboardContent({
          summary: data.summary || sectionSummaries.dashboard,
          actions: data.actions || dashboardActions,
          notes: data.notes || dashboardNotes,
          member: data.member || null,
          roleSections: data.roleSections || [],
        });
      })
      .catch(() => {
        setDashboardContent({
          summary: sectionSummaries.dashboard,
          actions: dashboardActions,
          notes: dashboardNotes,
          member: null,
          roleSections: [],
        });
      });

    return () => controller.abort();
  }, [token]);

  useEffect(() => {
    if (!token) {
      setPaymentHistory([]);
      setBookmarkedPosts([]);
      setRsvpEvents([]);
      return;
    }

    const controller = new AbortController();

    Promise.all([
      fetch(`${apiBase}/stripe/history`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      }).then(async (response) => {
        if (!response.ok) {
          throw new Error('Unable to load payment history');
        }

        return response.json();
      }),
      fetch(`${apiBase}/content/bookmarks`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      }).then((response) => response.json()),
      fetch(`${apiBase}/content/rsvps`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      }).then((response) => response.json()),
    ])
      .then(([paymentData, bookmarkData, rsvpData]) => {
        setPaymentHistory(paymentData.payments || []);
        setBookmarkedPosts(bookmarkData.bookmarks || []);
        setRsvpEvents(rsvpData.rsvps || []);
      })
      .catch(() => {
        setPaymentHistory([]);
        setBookmarkedPosts([]);
        setRsvpEvents([]);
      });

    return () => controller.abort();
  }, [token]);

  useEffect(() => {
    if (!token || view !== 'community-post' || !selectedPostId) {
      setSelectedPostDetail(null);
      return;
    }

    const controller = new AbortController();

    fetch(`${apiBase}/content/community/${selectedPostId}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Unable to load post details');
        }

        return response.json();
      })
      .then((data) => {
        setSelectedPostDetail(data);
      })
      .catch(() => {
        setSelectedPostDetail(null);
      });

    return () => controller.abort();
  }, [token, view, selectedPostId]);

  useEffect(() => {
    if (!token || view !== 'event-detail' || !selectedEventId) {
      setSelectedEventDetail(null);
      return;
    }

    const controller = new AbortController();

    fetch(`${apiBase}/content/events/${selectedEventId}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Unable to load event details');
        }

        return response.json();
      })
      .then((data) => {
        setSelectedEventDetail(data);
      })
      .catch(() => {
        setSelectedEventDetail(null);
      });

    return () => controller.abort();
  }, [token, view, selectedEventId]);

  useEffect(() => {
    if (!token || !isAdmin) {
      setPendingPosts([]);
      setPendingEvents([]);
      return;
    }

    const controller = new AbortController();

    fetch(`${apiBase}/content/pending`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then((response) => response.json())
      .then((data) => {
        setPendingPosts(data.pendingPosts || []);
        setPendingEvents(data.pendingEvents || []);
      })
      .catch(() => {
        setPendingPosts([]);
        setPendingEvents([]);
      });

    return () => controller.abort();
  }, [token, isAdmin]);

  function navigate(nextView, detailId) {
    setView(nextView);
    setStatusMessage('');

    if (typeof window !== 'undefined') {
      window.location.hash = detailId ? `${nextView}-${detailId}` : nextView;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function openPost(postId) {
    setSelectedPostId(postId);
    setSelectedEventId(null);
    navigate('community-post', postId);
  }

  function openEvent(eventId) {
    setSelectedEventId(eventId);
    setSelectedPostId(null);
    navigate('event-detail', eventId);
  }

  async function submitAuth(event) {
    event.preventDefault();
    setLoadingAuth(true);
    setAuthMessage('');

    try {
      const response = await fetch(`${apiBase}/auth/${auth.mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(auth),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      localStorage.setItem('token', data.token);
      setToken(data.token);
      setUser(data.user);
      setAuth(initialAuth);
      setStatusMessage(`Welcome, ${data.user.name}. Your account is ready.`);
      navigate('dashboard');
    } catch (error) {
      setAuthMessage(error.message);
    } finally {
      setLoadingAuth(false);
    }
  }

  async function submitPayment(event) {
    event.preventDefault();
    setLoadingPayment(true);
    setStatusMessage('');

    try {
      if (!token) {
        throw new Error('Please log in before starting a payment');
      }

      const amountCents = Math.round(Number(payment.amount) * 100);
      const response = await fetch(`${apiBase}/stripe/checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: payment.title,
          amountCents,
          quantity: 1,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Unable to create checkout session');
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      setStatusMessage(error.message);
    } finally {
      setLoadingPayment(false);
    }
  }

  async function saveProfile(event) {
    event.preventDefault();
    setLoadingProfile(true);
    setProfileMessage('');

    try {
      if (!token) {
        throw new Error('Please sign in to update your profile');
      }

      const response = await fetch(`${apiBase}/auth/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: profile.name,
          email: profile.email,
          currentPassword: profile.currentPassword,
          newPassword: profile.newPassword,
          preferences: {
            contactPreference: profile.contactPreference,
            interests: profile.interests,
            visibility: profile.visibility,
          },
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Unable to update profile');
      }

      if (data.token) {
        localStorage.setItem('token', data.token);
        setToken(data.token);
      }

      if (data.user) {
        setUser(data.user);
      }

      setProfile((current) => ({
        ...current,
        currentPassword: '',
        newPassword: '',
      }));
      setStatusMessage('Profile updated successfully.');
    } catch (error) {
      setProfileMessage(error.message);
    } finally {
      setLoadingProfile(false);
    }
  }

  async function savePost(event) {
    event.preventDefault();

    try {
      const method = editingPostId ? 'PUT' : 'POST';
      const endpoint = editingPostId ? `${apiBase}/content/community/${editingPostId}` : `${apiBase}/content/community`;

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(postEditor),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Unable to save post');
      }

      const nextPost = data.post;
      setCommunityPosts((current) => {
        if (editingPostId) {
          return current.map((post) => (post.id === editingPostId ? nextPost : post));
        }

        // Do not insert pending submissions into public lists for non-admin members
        if (!isAdmin && nextPost.status && nextPost.status !== 'approved') {
          return current;
        }

        return [nextPost, ...current];
      });
      setPostEditor({ title: '', meta: '', body: '' });
      setEditingPostId(null);
      setShowPostComposer(false);
      const message = editingPostId 
        ? 'Post updated.' 
        : isAdmin ? 'Post published.' : 'Post submitted for review.';
      showToast(message, 'success');
    } catch (error) {
      showToast(error.message, 'error');
    }
  }

  async function deletePost(postId) {
    if (!window.confirm('Delete this post? This action cannot be undone.')) return;

    try {
      const response = await fetch(`${apiBase}/content/community/${postId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Unable to delete post');
      }

      setCommunityPosts((current) => current.filter((post) => post.id !== postId));
      if (editingPostId === postId) {
        setEditingPostId(null);
        setPostEditor({ title: '', meta: '', body: '' });
      }
      showToast('Post removed.', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    }
  }

  async function saveEvent(event) {
    event.preventDefault();

    try {
      const method = editingEventId ? 'PUT' : 'POST';
      const endpoint = editingEventId ? `${apiBase}/content/events/${editingEventId}` : `${apiBase}/content/events`;

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(eventEditor),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Unable to save event');
      }

      const nextEvent = data.event;
      setEventRows((current) => {
        const mapped = {
          id: nextEvent.id,
          day: nextEvent.day_label,
          title: nextEvent.title,
          note: nextEvent.note,
          startsAt: nextEvent.starts_at,
        };

        if (editingEventId) {
          return current.map((item) => (item.id === editingEventId ? mapped : item));
        }

        // For non-admin creators, don't show pending events in the public list immediately
        if (!isAdmin && nextEvent.status && nextEvent.status !== 'approved') {
          return current;
        }

        return [...current, mapped].sort((left, right) => new Date(left.startsAt) - new Date(right.startsAt));
      });
      setEventEditor({ dayLabel: '', title: '', note: '', startsAt: '' });
      setEditingEventId(null);
      setShowEventComposer(false);
      const message = editingEventId 
        ? 'Event updated.' 
        : isAdmin ? 'Event published.' : 'Event submitted for review.';
      showToast(message, 'success');
    } catch (error) {
      showToast(error.message, 'error');
    }
  }

  async function deleteEvent(eventId) {
    if (!window.confirm('Delete this event? This action cannot be undone.')) return;

    try {
      const response = await fetch(`${apiBase}/content/events/${eventId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Unable to delete event');
      }

      setEventRows((current) => current.filter((item) => item.id !== eventId));
      if (editingEventId === eventId) {
        setEditingEventId(null);
        setEventEditor({ dayLabel: '', title: '', note: '', startsAt: '' });
      }
      showToast('Event removed.', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    }
  }

  async function approvePost(postId) {
    try {
      const response = await fetch(`${apiBase}/content/community/${postId}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Unable to approve post');
      }

      setPendingPosts((current) => current.filter((post) => post.id !== postId));
      setCommunityPosts((current) => [
        ...current,
        {
          id: data.post.id,
          title: data.post.title,
          meta: data.post.meta,
          body: data.post.body,
          status: 'approved',
          bookmarkCount: 0,
        },
      ]);
      showToast('Post approved and published.', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    }
  }

  async function rejectPost(postId) {
    try {
      const response = await fetch(`${apiBase}/content/community/${postId}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Unable to reject post');
      }

      setPendingPosts((current) => current.filter((post) => post.id !== postId));
      showToast('Post rejected.', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    }
  }

  async function approveEvent(eventId) {
    try {
      const response = await fetch(`${apiBase}/content/events/${eventId}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Unable to approve event');
      }

      setPendingEvents((current) => current.filter((e) => e.id !== eventId));
      showToast('Event approved and published.', 'success');
      // Reload events to show the newly approved one
      fetch(`${apiBase}/content/events`)
        .then((response) => response.json())
        .then((eventData) => {
          if (eventData?.events) {
            setEventRows(
              eventData.events.map((event) => ({
                id: event.id,
                day: event.day_label,
                title: event.title,
                note: event.note,
                startsAt: event.starts_at,
                rsvpCount: event.rsvp_count || 0,
              }))
            );
          }
        })
        .catch(() => {});
    } catch (error) {
      showToast(error.message, 'error');
    }
  }

  async function rejectEvent(eventId) {
    try {
      const response = await fetch(`${apiBase}/content/events/${eventId}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Unable to reject event');
      }

      setPendingEvents((current) => current.filter((e) => e.id !== eventId));
      showToast('Event rejected.', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    }
  }

  function startEditPost(post) {
    setEditingPostId(post.id);
    setPostEditor({ title: post.title, meta: post.meta, body: post.body });
  }

  function startEditEvent(item) {
    setEditingEventId(item.id);
    setEventEditor({
      dayLabel: item.day,
      title: item.title,
      note: item.note,
      startsAt: item.startsAt || '',
    });
  }

  function showToast(message, kind = 'info') {
    const id = Date.now() + Math.random().toString(36).slice(2, 7);
    const toast = { id, message, kind };
    setToasts((t) => [...t, toast]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 4000);
  }

  async function toggleBookmark(postId) {
    if (!token) {
      showToast('Please sign in to bookmark posts.', 'error');
      return;
    }

    try {
      const response = await fetch(`${apiBase}/content/community/${postId}/bookmark`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Unable to update bookmark');
      }

      const bookmarked = Boolean(data.bookmarked);
      setBookmarkedPosts((current) => {
        if (bookmarked) {
          const post = communityPosts.find((item) => item.id === postId);
          return post ? [post, ...current.filter((item) => item.id !== postId)] : current;
        }

        return current.filter((item) => item.id !== postId);
      });
      setSelectedPostDetail((current) =>
        current && current.post?.id === postId
          ? {
              ...current,
              post: {
                ...current.post,
                bookmarked,
              },
            }
          : current
      );
      showToast(bookmarked ? 'Post bookmarked.' : 'Bookmark removed.', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    }
  }

  async function toggleRsvp(eventId) {
    if (!token) {
      showToast('Please sign in to RSVP for events.', 'error');
      return;
    }

    try {
      const response = await fetch(`${apiBase}/content/events/${eventId}/rsvp`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Unable to update RSVP');
      }

      const rsvped = Boolean(data.rsvped);
      setRsvpEvents((current) => {
        if (rsvped) {
          const event = eventRows.find((item) => item.id === eventId);
          return event ? [event, ...current.filter((item) => item.id !== eventId)] : current;
        }

        return current.filter((item) => item.id !== eventId);
      });
      setSelectedEventDetail((current) =>
        current && current.event?.id === eventId
          ? {
              ...current,
              event: {
                ...current.event,
                rsvped,
              },
            }
          : current
      );
      showToast(rsvped ? 'RSVP saved.' : 'RSVP removed.', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    }
  }

  async function submitPostComment(event) {
    event.preventDefault();

    if (!selectedPostId || !postCommentBody.trim()) {
      return;
    }

    try {
      const response = await fetch(`${apiBase}/content/community/${selectedPostId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ body: postCommentBody }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Unable to add comment');
      }

      setSelectedPostDetail((current) =>
        current
          ? {
              ...current,
              comments: [...current.comments, data.comment],
              post: {
                ...current.post,
                comment_count: (current.post.comment_count || 0) + 1,
              },
            }
          : current
      );
      setPostCommentBody('');
      showToast('Comment added.', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    }
  }

  async function submitEventComment(event) {
    event.preventDefault();

    if (!selectedEventId || !eventCommentBody.trim()) {
      return;
    }

    try {
      const response = await fetch(`${apiBase}/content/events/${selectedEventId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ body: eventCommentBody }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Unable to add comment');
      }

      setSelectedEventDetail((current) =>
        current
          ? {
              ...current,
              comments: [...current.comments, data.comment],
              event: {
                ...current.event,
                comment_count: (current.event.comment_count || 0) + 1,
              },
            }
          : current
      );
      setEventCommentBody('');
      showToast('Comment added.', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    }
  }

  async function reactToPost(reaction) {
    if (!selectedPostId) return;

    try {
      const response = await fetch(`${apiBase}/content/community/${selectedPostId}/reaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reaction }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Unable to update reaction');
      }

      setSelectedPostDetail((current) =>
        current
          ? {
              ...current,
              post: {
                ...current.post,
                like_count:
                  reaction === 'like'
                    ? (current.post.my_reaction === 'like' ? current.post.like_count : current.post.like_count + 1)
                    : current.post.my_reaction === 'like'
                      ? Math.max(0, current.post.like_count - 1)
                      : current.post.like_count,
                dislike_count:
                  reaction === 'dislike'
                    ? (current.post.my_reaction === 'dislike' ? current.post.dislike_count : current.post.dislike_count + 1)
                    : current.post.my_reaction === 'dislike'
                      ? Math.max(0, current.post.dislike_count - 1)
                      : current.post.dislike_count,
                my_reaction: data.reaction,
              },
            }
          : current
      );
    } catch (error) {
      showToast(error.message, 'error');
    }
  }

  async function reactToEvent(reaction) {
    if (!selectedEventId) return;

    try {
      const response = await fetch(`${apiBase}/content/events/${selectedEventId}/reaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reaction }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Unable to update reaction');
      }

      setSelectedEventDetail((current) =>
        current
          ? {
              ...current,
              event: {
                ...current.event,
                like_count:
                  reaction === 'like'
                    ? (current.event.my_reaction === 'like' ? current.event.like_count : current.event.like_count + 1)
                    : current.event.my_reaction === 'like'
                      ? Math.max(0, current.event.like_count - 1)
                      : current.event.like_count,
                dislike_count:
                  reaction === 'dislike'
                    ? (current.event.my_reaction === 'dislike' ? current.event.dislike_count : current.event.dislike_count + 1)
                    : current.event.my_reaction === 'dislike'
                      ? Math.max(0, current.event.dislike_count - 1)
                      : current.event.dislike_count,
                my_reaction: data.reaction,
              },
            }
          : current
      );
    } catch (error) {
      showToast(error.message, 'error');
    }
  }

  async function saveProfile(event) {
    event.preventDefault();
    setLoadingProfile(true);
    setProfileMessage('');

    try {
      if (!token) {
        throw new Error('Please sign in to update your profile');
      }

      const response = await fetch(`${apiBase}/auth/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(profile),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Unable to update profile');
      }

      if (data.token) {
        localStorage.setItem('token', data.token);
        setToken(data.token);
      }

      if (data.user) {
        setUser(data.user);
      }

      setProfile((current) => ({
        ...current,
        currentPassword: '',
        newPassword: '',
      }));
      setStatusMessage('Profile updated successfully.');
    } catch (error) {
      setProfileMessage(error.message);
    } finally {
      setLoadingProfile(false);
    }
  }

  function signOut() {
    localStorage.removeItem('token');
    setToken('');
    setUser(null);
    setStatusMessage('Signed out.');
    navigate('home');
  }

  return (
    <div className="page-shell">
      <div className="grain" />

      <header className="topbar">
        <button className="brand-lockup button-reset" type="button" onClick={() => navigate('home')}>
          <span className="brand-mark">SH</span>
          <span>
            <span className="brand-kicker">Stitch Village</span>
            <span className="brand-title">Community Hub</span>
          </span>
        </button>

        <nav className="topnav" aria-label="Primary">
          {views.map((item) => {
            if ((item === 'admin' && !isAdmin) || item === 'community-post' || item === 'event-detail') return null;
            return (
              <button
                key={item}
                type="button"
                className={view === item ? 'nav-link active' : 'nav-link'}
                onClick={() => navigate(item)}
              >
                {item === 'account' ? 'Account' : item === 'admin' ? 'Admin' : item[0].toUpperCase() + item.slice(1)}
              </button>
            );
          })}
        </nav>

        <div className="top-actions">
          {view !== 'home' ? (
            <button className="button ghost" type="button" onClick={() => navigate('donate')}>
              Support now
            </button>
          ) : null}
          {!isLoggedIn ? (
            <button className="button primary" type="button" onClick={() => navigate('account')}>
              Join the village
            </button>
          ) : null}
        </div>
      </header>

      <main className="layout" id="top">
        <section className="card page-header">
          <div>
            <div className="eyebrow">{view}</div>
            <h1>{currentSummary.title}</h1>
            <p>{currentSummary.copy}</p>
          </div>

          <div className="page-header-actions">
            <span className="badge">{isLoggedIn ? 'Signed in' : 'Guest mode'}</span>
          </div>
        </section>

        {view === 'home' ? (
          <>
            <section className="hero card-hero">
              <div className="hero-copy">
                <div className="eyebrow">Digital hearthside</div>
                <h2>Community tools shaped like a real town square.</h2>
                <p>
                  Everything important lives in one place: updates, events, support, and member access.
                </p>
              </div>

              <aside className="hero-panel">
                <div className="hero-panel-card">
                  <span className="eyebrow">Today in the village</span>
                  <strong>Fresh produce drops, evening updates, and the Friday support circle.</strong>
                  <p>Everything flows through one shared place so neighbors can stay informed and involved.</p>
                </div>

                <div className="hero-stats">
                  {homeHighlights.map((stat) => (
                    <div key={stat.label} className="stat-card">
                      <span>{stat.label}</span>
                      <strong>{stat.value}</strong>
                    </div>
                  ))}
                </div>
              </aside>
            </section>

            <section className="feature-grid">
              <article className="card panel">
                <div className="section-header">
                  <div>
                    <div className="eyebrow">Quick look</div>
                    <h2>Fast access to the hub</h2>
                  </div>
                  <span className="badge">Overview</span>
                </div>

                <div className="link-grid">
                  <button type="button" className="link-card" onClick={() => navigate('dashboard')}>
                    <strong>Dashboard</strong>
                    <p>Personal summary and member tools.</p>
                  </button>
                  <button type="button" className="link-card" onClick={() => navigate('donate')}>
                    <strong>Community</strong>
                    <p>Notices, posts, and local updates.</p>
                  </button>
                </div>
              </article>

              <article className="card panel">
                <div className="section-header">
                  <div>
                    <div className="eyebrow">Member story</div>
                    <h2>A place that feels steady and familiar</h2>
                  </div>
                  <span className="badge">Design system</span>
                </div>

                <div className="notice-board">
                  <p>
                    The interface uses warm surfaces, calm typography, and clear calls to action so the
                    experience feels like a local bulletin board rather than a cold software dashboard.
                  </p>
                  <p>
                    The backend remains focused on auth, persistence, and payments while the UI stays product
                    oriented for the community.
                  </p>
                </div>
              </article>
            </section>

            <section className="preview-grid">
              <article className="card panel">
                <div className="section-header">
                  <div>
                    <div className="eyebrow">Latest updates</div>
                    <h2>Community posts</h2>
                  </div>
                  <button className="pill" type="button" onClick={() => navigate('community')}>
                    See more
                  </button>
                </div>

                <div className="preview-list">
                  {communityPosts.slice(0, 2).map((post) => (
                    <div key={post.id} className="preview-item">
                      <p className="item-meta">{post.meta}</p>
                      <h4>{post.title}</h4>
                      <p className="item-excerpt">{post.body}</p>
                    </div>
                  ))}
                  {communityPosts.length === 0 ? (
                    <p className="empty-text">No posts yet. Activity will appear here soon.</p>
                  ) : null}
                </div>
              </article>

              <article className="card panel">
                <div className="section-header">
                  <div>
                    <div className="eyebrow">Coming soon</div>
                    <h2>Upcoming events</h2>
                  </div>
                  <button className="pill" type="button" onClick={() => navigate('events')}>
                    See more
                  </button>
                </div>

                <div className="preview-list">
                  {eventRows.slice(0, 2).map((event) => (
                    <div key={event.id} className="preview-item event-preview">
                      <span className="event-tag">{event.day}</span>
                      <div>
                        <h4>{event.title}</h4>
                        <p className="item-excerpt">{event.note}</p>
                      </div>
                    </div>
                  ))}
                  {eventRows.length === 0 ? (
                    <p className="empty-text">No events scheduled. Check back soon.</p>
                  ) : null}
                </div>
              </article>
            </section>
          </>
        ) : null}

        {view === 'dashboard' ? (
          <section className="card panel dashboard-panel">
            <div className="section-header">
              <div>
                <div className="eyebrow">Member dashboard</div>
                <h2>{dashboardContent.summary?.title || (isLoggedIn ? 'Your village workspace' : 'Sign in to unlock your workspace')}</h2>
              </div>
              <span className="badge">Personalized</span>
            </div>

            <div className="dashboard-grid">
              <div className="dashboard-summary">
                <span>Welcome</span>
                <strong>{dashboardContent.member?.name || (isLoggedIn ? user.name : 'Neighbor')}</strong>
                <p>
                  {dashboardContent.summary?.copy ||
                    (isLoggedIn
                      ? 'You are signed in and ready to take part in the community hub.'
                      : 'Create an account or sign in to save your preferences and support the village.')}
                </p>
                {dashboardContent.member ? (
                  <p>
                    Support contributions: {dashboardContent.member.supportCount} · Total raised: {money(dashboardContent.member.supportTotalCents)}
                  </p>
                ) : null}
                {dashboardContent.member ? (
                  <p>
                    Bookmarks: {dashboardContent.member.bookmarkCount} · RSVPs: {dashboardContent.member.rsvpCount}
                  </p>
                ) : null}
              </div>

              <div className="dashboard-actions">
                <h3>Quick actions</h3>
                <ul>
                  {dashboardContent.actions.map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
              </div>

              <div className="dashboard-notes">
                <h3>Member notes</h3>
                <ul>
                  {dashboardContent.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="saved-grid">
              <div className="saved-panel">
                <h3>Saved bookmarks</h3>
                {bookmarkedPosts.length > 0 ? (
                  bookmarkedPosts.map((post) => (
                    <div key={post.id} className="saved-row" onClick={() => openPost(post.id)}>
                      <div>
                        <strong>{post.title}</strong>
                        <p>{post.meta}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState title="No bookmarks yet" description="Bookmark posts from the Community board to keep them handy." />
                )}
              </div>

              <div className="saved-panel">
                <h3>Saved RSVPs</h3>
                {rsvpEvents.length > 0 ? (
                  rsvpEvents.map((event) => (
                    <div key={event.id} className="saved-row" onClick={() => openEvent(event.id)}>
                      <div>
                        <strong>{event.title}</strong>
                        <p>{event.day}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState title="No RSVPs yet" description="RSVP to upcoming events to see them here." />
                )}
              </div>
            </div>

            {dashboardContent.roleSections.length > 0 ? (
              <div className="role-section-grid">
                {dashboardContent.roleSections.map((section) => (
                  <article key={section.title} className="role-card">
                    <div className="eyebrow">Admin tools</div>
                    <h3>{section.title}</h3>
                    <p>{section.copy}</p>
                  </article>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        {view === 'community' ? (
          <section className="card panel">
            <div className="section-header">
              <div>
                <div className="eyebrow">Community board</div>
                <h2>News, notices, and neighbor updates</h2>
              </div>
              <div className="section-header-actions">
                <span className="badge">Live feed</span>
                {isLoggedIn ? (
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={showPostComposer ? 'Hide post composer' : 'Create a community post'}
                    onClick={() => setShowPostComposer((current) => !current)}
                  >
                    {showPostComposer ? '−' : '+'}
                  </button>
                ) : null}
              </div>
            </div>

            {isLoggedIn && showPostComposer ? (
              <div className="editor-panel">
                <div className="section-header">
                  <div>
                    <div className="eyebrow">Share something</div>
                    <h3>Create a community post</h3>
                  </div>
                  <span className="badge">{isAdmin ? 'Admin' : 'Member'}</span>
                </div>

                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    savePost(event);
                  }}
                >
                  <div className="profile-form-grid">
                    <label>
                      Title
                      <input
                        value={postEditor.title}
                        onChange={(e) => setPostEditor((current) => ({ ...current, title: e.target.value }))}
                        placeholder="What's happening?"
                      />
                    </label>
                    <label>
                      Meta
                      <input
                        value={postEditor.meta}
                        onChange={(e) => setPostEditor((current) => ({ ...current, meta: e.target.value }))}
                        placeholder="Town square • Just now"
                      />
                    </label>
                  </div>
                  <label>
                    Message
                    <textarea
                      value={postEditor.body}
                      onChange={(e) => setPostEditor((current) => ({ ...current, body: e.target.value }))}
                      rows="3"
                      placeholder="Share your thoughts or news with the community."
                    />
                  </label>

                  <div className="editor-actions">
                    <button className="button primary" type="submit">
                      {isAdmin ? 'Publish post' : 'Submit for review'}
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              !isLoggedIn ? (
                <div className="notice-board">
                  <p>Sign in to share a post with the community.</p>
                </div>
              ) : null
            )}

            <div className="board-list">
              {communityPosts.length > 0 ? (
                communityPosts.map((item) => {
                  const isBookmarked = bookmarkedPosts.some((post) => post.id === item.id);

                  return (
                    <article key={item.id} className="board-card" onClick={() => openPost(item.id)}>
                      <p className="board-meta">{item.meta}</p>
                      <h3>{item.title}</h3>
                      <p>{item.body}</p>
                      <div className="card-actions">
                        <button
                          className="pill"
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleBookmark(item.id);
                          }}
                        >
                          {isBookmarked ? 'Remove bookmark' : 'Bookmark'}
                        </button>
                        {isBookmarked ? <span className="badge">Saved</span> : null}
                      </div>
                    </article>
                  );
                })
              ) : (
                <EmptyState
                  title="No community posts yet"
                  description="Once members start sharing, posts will appear here."
                />
              )}
            </div>
          </section>
        ) : null}

        {view === 'events' ? (
          <section className="card panel">
            <div className="section-header">
              <div>
                <div className="eyebrow">Events</div>
                <h2>What&apos;s on this week</h2>
              </div>
              <div className="section-header-actions">
                <span className="badge">Open to all</span>
                {isLoggedIn ? (
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={showEventComposer ? 'Hide event composer' : 'Create an event'}
                    onClick={() => setShowEventComposer((current) => !current)}
                  >
                    {showEventComposer ? '−' : '+'}
                  </button>
                ) : null}
              </div>
            </div>

            {isLoggedIn && showEventComposer ? (
              <div className="editor-panel">
                <div className="section-header">
                  <div>
                    <div className="eyebrow">Plan something</div>
                    <h3>Create an event</h3>
                  </div>
                  <span className="badge">{isAdmin ? 'Admin' : 'Member'}</span>
                </div>

                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    saveEvent(event);
                  }}
                >
                  <div className="profile-form-grid">
                    <label>
                      Day label
                      <input
                        value={eventEditor.dayLabel}
                        onChange={(e) => setEventEditor((current) => ({ ...current, dayLabel: e.target.value }))}
                        placeholder="Sat 22"
                      />
                    </label>
                    <label>
                      Starts at
                      <input
                        type="datetime-local"
                        value={eventEditor.startsAt}
                        onChange={(e) => setEventEditor((current) => ({ ...current, startsAt: e.target.value }))}
                      />
                    </label>
                    <label>
                      Title
                      <input
                        value={eventEditor.title}
                        onChange={(e) => setEventEditor((current) => ({ ...current, title: e.target.value }))}
                        placeholder="Event name"
                      />
                    </label>
                    <label>
                      Note
                      <input
                        value={eventEditor.note}
                        onChange={(e) => setEventEditor((current) => ({ ...current, note: e.target.value }))}
                        placeholder="Time, location, details"
                      />
                    </label>
                  </div>

                  <div className="editor-actions">
                    <button className="button primary" type="submit">
                      {isAdmin ? 'Publish event' : 'Submit for review'}
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              !isLoggedIn ? (
                <div className="notice-board">
                  <p>Sign in to create an event for the community.</p>
                </div>
              ) : null
            )}

            <div className="event-list">
              {eventRows.length > 0 ? (
                eventRows.map((event) => {
                  const isRsvped = rsvpEvents.some((savedEvent) => savedEvent.id === event.id);

                  return (
                    <div key={event.id} className="event-card" onClick={() => openEvent(event.id)}>
                      <span className="event-day">{event.day}</span>
                      <div>
                        <h3>{event.title}</h3>
                        <p>{event.note}</p>
                        <div className="card-actions">
                          <button
                            className="pill"
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleRsvp(event.id);
                            }}
                          >
                            {isRsvped ? 'Cancel RSVP' : 'RSVP'}
                          </button>
                          {isRsvped ? <span className="badge">Going</span> : null}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <EmptyState
                  title="No upcoming events"
                  description="Once events are scheduled, they will appear here."
                />
              )}
            </div>
          </section>
        ) : null}

        {view === 'community-post' ? (
          <section className="card panel detail-panel">
            <div className="section-header">
              <div>
                <div className="eyebrow">Community post</div>
                <h2>{selectedPostDetail?.post?.title || 'Post details'}</h2>
                <p>{selectedPostDetail?.post?.meta || currentSummary.copy}</p>
              </div>
              <div className="section-header-actions">
                <span className="badge">{selectedPostDetail?.post?.status || 'Loading'}</span>
                <button className="pill" type="button" onClick={() => navigate('community')}>
                  Back to board
                </button>
              </div>
            </div>

            {selectedPostDetail?.post ? (
              <>
                <div className="detail-hero">
                  <p>{selectedPostDetail.post.body}</p>
                  <div className="reaction-bar">
                    <button className="pill" type="button" onClick={() => reactToPost('like')}>
                      Like {selectedPostDetail.post.like_count ? `(${selectedPostDetail.post.like_count})` : ''}
                    </button>
                    <button className="pill" type="button" onClick={() => reactToPost('dislike')}>
                      Dislike {selectedPostDetail.post.dislike_count ? `(${selectedPostDetail.post.dislike_count})` : ''}
                    </button>
                    <button className="pill" type="button" onClick={() => toggleBookmark(selectedPostDetail.post.id)}>
                      {selectedPostDetail.post.bookmarked ? 'Remove bookmark' : 'Bookmark'}
                    </button>
                    {selectedPostDetail.post.my_reaction ? <span className="badge">{selectedPostDetail.post.my_reaction}</span> : null}
                    {selectedPostDetail.post.bookmarked ? <span className="badge">Saved</span> : null}
                  </div>
                </div>

                <div className="detail-section">
                  <div className="section-header">
                    <div>
                      <div className="eyebrow">Conversation</div>
                      <h3>{selectedPostDetail.post.comment_count || 0} comments</h3>
                    </div>
                  </div>

                  {isLoggedIn ? (
                    <form className="detail-comment-form" onSubmit={submitPostComment}>
                      <label>
                        Add a comment
                        <textarea value={postCommentBody} onChange={(event) => setPostCommentBody(event.target.value)} rows="3" />
                      </label>
                      <div className="editor-actions">
                        <button className="button primary" type="submit">
                          Post comment
                        </button>
                      </div>
                    </form>
                  ) : null}

                  <div className="comment-list">
                    {selectedPostDetail.comments.length > 0 ? (
                      selectedPostDetail.comments.map((comment) => (
                        <article key={comment.id} className="comment-card">
                          <strong>{comment.name}</strong>
                          <p>{comment.body}</p>
                          <span>{new Date(comment.created_at).toLocaleString()}</span>
                        </article>
                      ))
                    ) : (
                      <EmptyState title="No comments yet" description="Start the conversation here." />
                    )}
                  </div>
                </div>
              </>
            ) : (
              <EmptyState
                title={isLoggedIn ? 'Loading post' : 'Sign in to view post details'}
                description={isLoggedIn ? 'Fetching the latest post details.' : 'You need to sign in to open a post and interact with it.'}
              />
            )}
          </section>
        ) : null}

        {view === 'event-detail' ? (
          <section className="card panel detail-panel">
            <div className="section-header">
              <div>
                <div className="eyebrow">Event</div>
                <h2>{selectedEventDetail?.event?.title || 'Event details'}</h2>
                <p>{selectedEventDetail?.event?.note || currentSummary.copy}</p>
              </div>
              <div className="section-header-actions">
                <span className="badge">{selectedEventDetail?.event?.status || 'Loading'}</span>
                <button className="pill" type="button" onClick={() => navigate('events')}>
                  Back to events
                </button>
              </div>
            </div>

            {selectedEventDetail?.event ? (
              <>
                <div className="detail-hero">
                  <p>{selectedEventDetail.event.day_label} · {new Date(selectedEventDetail.event.starts_at).toLocaleString()}</p>
                  <div className="reaction-bar">
                    <button className="pill" type="button" onClick={() => reactToEvent('like')}>
                      Like {selectedEventDetail.event.like_count ? `(${selectedEventDetail.event.like_count})` : ''}
                    </button>
                    <button className="pill" type="button" onClick={() => reactToEvent('dislike')}>
                      Dislike {selectedEventDetail.event.dislike_count ? `(${selectedEventDetail.event.dislike_count})` : ''}
                    </button>
                    <button className="pill" type="button" onClick={() => toggleRsvp(selectedEventDetail.event.id)}>
                      {selectedEventDetail.event.rsvped ? 'Cancel RSVP' : 'RSVP'}
                    </button>
                    {selectedEventDetail.event.rsvped ? <span className="badge">Going</span> : null}
                  </div>
                </div>

                <div className="detail-section">
                  <div className="section-header">
                    <div>
                      <div className="eyebrow">Conversation</div>
                      <h3>{selectedEventDetail.event.comment_count || 0} comments</h3>
                    </div>
                  </div>

                  {isLoggedIn ? (
                    <form className="detail-comment-form" onSubmit={submitEventComment}>
                      <label>
                        Add a comment
                        <textarea value={eventCommentBody} onChange={(event) => setEventCommentBody(event.target.value)} rows="3" />
                      </label>
                      <div className="editor-actions">
                        <button className="button primary" type="submit">
                          Post comment
                        </button>
                      </div>
                    </form>
                  ) : null}

                  <div className="comment-list">
                    {selectedEventDetail.comments.length > 0 ? (
                      selectedEventDetail.comments.map((comment) => (
                        <article key={comment.id} className="comment-card">
                          <strong>{comment.name}</strong>
                          <p>{comment.body}</p>
                          <span>{new Date(comment.created_at).toLocaleString()}</span>
                        </article>
                      ))
                    ) : (
                      <EmptyState title="No comments yet" description="Start the conversation here." />
                    )}
                  </div>
                </div>
              </>
            ) : (
              <EmptyState
                title={isLoggedIn ? 'Loading event' : 'Sign in to view event details'}
                description={isLoggedIn ? 'Fetching the latest event details.' : 'You need to sign in to open an event and interact with it.'}
              />
            )}
          </section>
        ) : null}

        {view === 'admin' ? (
          <section className="card panel">
            <div className="section-header">
              <div>
                <div className="eyebrow">Admin</div>
                <h2>Content management</h2>
              </div>
              <span className="badge">Restricted</span>
            </div>

            {!isAdmin ? (
              <div className="notice-board">
                <p>You do not have access to this area.</p>
              </div>
            ) : (
              <>
                {(pendingPosts.length > 0 || pendingEvents.length > 0) ? (
                  <div className="role-section-grid">
                    {pendingPosts.length > 0 ? (
                      <div className="admin-list">
                        <h3>Pending posts for review</h3>
                        {pendingPosts.map((post) => (
                          <div key={post.id} className="admin-row">
                            <div>
                              <strong>{post.title}</strong>
                              <p>{post.meta}</p>
                            </div>
                            <div className="admin-row-actions">
                              <button className="pill" type="button" onClick={() => approvePost(post.id)}>
                                Approve
                              </button>
                              <button className="pill danger" type="button" onClick={() => rejectPost(post.id)}>
                                Reject
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {pendingEvents.length > 0 ? (
                      <div className="admin-list">
                        <h3>Pending events for review</h3>
                        {pendingEvents.map((event) => (
                          <div key={event.id} className="admin-row">
                            <div>
                              <strong>{event.title}</strong>
                              <p>{event.note}</p>
                            </div>
                            <div className="admin-row-actions">
                              <button className="pill" type="button" onClick={() => approveEvent(event.id)}>
                                Approve
                              </button>
                              <button className="pill danger" type="button" onClick={() => rejectEvent(event.id)}>
                                Reject
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="role-section-grid">
                <div>
                  <div className="editor-panel">
                    <div className="section-header">
                      <div>
                        <div className="eyebrow">Publishing tools</div>
                        <h3>{editingPostId ? 'Edit community post' : 'Create community post'}</h3>
                      </div>
                      <span className="badge">Admin only</span>
                    </div>

                    <form onSubmit={savePost}>
                      <div className="profile-form-grid">
                        <label>
                          Title
                          <input
                            value={postEditor.title}
                            onChange={(event) => setPostEditor((current) => ({ ...current, title: event.target.value }))}
                          />
                        </label>
                        <label>
                          Meta
                          <input
                            value={postEditor.meta}
                            onChange={(event) => setPostEditor((current) => ({ ...current, meta: event.target.value }))}
                            placeholder="Town square • Just now"
                          />
                        </label>
                      </div>
                      <label>
                        Body
                        <textarea
                          value={postEditor.body}
                          onChange={(event) => setPostEditor((current) => ({ ...current, body: event.target.value }))}
                          rows="4"
                        />
                      </label>

                      <div className="editor-actions">
                        <button className="button primary" type="submit">
                          {editingPostId ? 'Save post' : 'Publish post'}
                        </button>
                        {editingPostId ? (
                          <button
                            className="button ghost"
                            type="button"
                            onClick={() => {
                              setEditingPostId(null);
                              setPostEditor({ title: '', meta: '', body: '' });
                            }}
                          >
                            Cancel edit
                          </button>
                        ) : null}
                      </div>
                    </form>
                  </div>

                  <div className="admin-list">
                    <h3>Manage posts</h3>
                    {communityPosts.map((post) => (
                      <div key={post.id} className="admin-row">
                        <div>
                          <strong>{post.title}</strong>
                          <p>{post.meta}</p>
                        </div>
                        <div className="admin-row-actions">
                          <button className="pill" type="button" onClick={() => startEditPost(post)}>
                            Edit
                          </button>
                          <button className="pill danger" type="button" onClick={() => deletePost(post.id)}>
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="editor-panel">
                    <div className="section-header">
                      <div>
                        <div className="eyebrow">Publishing tools</div>
                        <h3>{editingEventId ? 'Edit event' : 'Create event'}</h3>
                      </div>
                      <span className="badge">Admin only</span>
                    </div>

                    <form onSubmit={saveEvent}>
                      <div className="profile-form-grid">
                        <label>
                          Day label
                          <input
                            value={eventEditor.dayLabel}
                            onChange={(event) => setEventEditor((current) => ({ ...current, dayLabel: event.target.value }))}
                            placeholder="Sat 22"
                          />
                        </label>
                        <label>
                          Starts at
                          <input
                            type="datetime-local"
                            value={eventEditor.startsAt}
                            onChange={(event) => setEventEditor((current) => ({ ...current, startsAt: event.target.value }))}
                          />
                        </label>
                        <label>
                          Title
                          <input
                            value={eventEditor.title}
                            onChange={(event) => setEventEditor((current) => ({ ...current, title: event.target.value }))}
                          />
                        </label>
                        <label>
                          Note
                          <input
                            value={eventEditor.note}
                            onChange={(event) => setEventEditor((current) => ({ ...current, note: event.target.value }))}
                          />
                        </label>
                      </div>

                      <div className="editor-actions">
                        <button className="button primary" type="submit">
                          {editingEventId ? 'Save event' : 'Publish event'}
                        </button>
                        {editingEventId ? (
                          <button
                            className="button ghost"
                            type="button"
                            onClick={() => {
                              setEditingEventId(null);
                              setEventEditor({ dayLabel: '', title: '', note: '', startsAt: '' });
                            }}
                          >
                            Cancel edit
                          </button>
                        ) : null}
                      </div>
                    </form>
                  </div>

                  <div className="admin-list">
                    <h3>Manage events</h3>
                    {eventRows.map((item) => (
                      <div key={item.id} className="admin-row">
                        <div>
                          <strong>{item.title}</strong>
                          <p>{item.note}</p>
                        </div>
                        <div className="admin-row-actions">
                          <button className="pill" type="button" onClick={() => startEditEvent(item)}>
                            Edit
                          </button>
                          <button className="pill danger" type="button" onClick={() => deleteEvent(item.id)}>
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              </>
            )}
          </section>
        ) : null}

        {view === 'donate' ? (
          <section className="card panel callout">
            <div className="section-header">
              <div>
                <div className="eyebrow">Support the village</div>
                <h2>Make a one-time donation</h2>
              </div>
              <span className="badge">Stripe checkout</span>
            </div>

            <p>
              Help fund gatherings, outreach, and shared resources. Your payment goes through Stripe and
              is recorded for the community ledger.
            </p>

            <div className="support-levels">
              {supportLevels.map((level) => (
                <div key={level.name} className="support-card">
                  <strong>
                    {level.name} <span>{level.amount}</span>
                  </strong>
                  <p>{level.detail}</p>
                </div>
              ))}
            </div>

            <form className="payment-form" onSubmit={submitPayment}>
              <label>
                Donation label
                <input
                  value={payment.title}
                  onChange={(event) => setPayment((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Village support donation"
                />
              </label>
              <label>
                Amount in USD
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={payment.amount}
                  onChange={(event) => setPayment((current) => ({ ...current, amount: event.target.value }))}
                  placeholder="25"
                />
              </label>
              <div className="payment-summary">
                <span>Checkout total</span>
                <strong>{money(Math.max(0, Number(payment.amount || 0) * 100))}</strong>
              </div>
              <button className="button secondary full" type="submit" disabled={loadingPayment}>
                {loadingPayment ? 'Creating session...' : 'Continue to secure checkout'}
              </button>
            </form>

            {token ? (
              <div className="notice-board payment-history">
                <h3>Recent payments</h3>
                {paymentHistory.length > 0 ? (
                  paymentHistory.map((item) => (
                    <div key={item.id} className="payment-history-row">
                      <div>
                        <strong>{money(item.amount_cents)}</strong>
                        <p>{item.status} · {new Date(item.created_at).toLocaleString()}</p>
                      </div>
                      <span className="badge">{item.currency.toUpperCase()}</span>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    title="No payments yet"
                    description="Your Stripe donations will appear here once a checkout session has been completed."
                  />
                )}
              </div>
            ) : null}
          </section>
        ) : null}

        {view === 'account' ? (
          <section className="card panel account-panel">
            <div className="section-header">
              <div>
                <div className="eyebrow">Account</div>
                <h2>{isLoggedIn ? user.name : 'Join the village'}</h2>
              </div>
              {isLoggedIn ? (
                <button className="pill danger" type="button" onClick={signOut}>
                  Sign out
                </button>
              ) : null}
            </div>

            <div className="profile-grid">
              <div>
                <span>Status</span>
                <strong>{isLoggedIn ? (isAdmin ? 'Admin member' : 'Member') : 'Guest'}</strong>
              </div>
              <div>
                <span>Access</span>
                <strong>Community home</strong>
              </div>
              <div>
                <span>Support</span>
                <strong>Ready to donate</strong>
              </div>
              <div>
                <span>Preferences</span>
                <strong>{profile.contactPreference.toUpperCase()}</strong>
              </div>
            </div>

            {isLoggedIn ? (
              <form className="profile-form" onSubmit={saveProfile}>
                <div className="section-header">
                  <div>
                    <div className="eyebrow">Profile settings</div>
                {dashboardContent.member?.role ? <p>Role: {dashboardContent.member.role}</p> : null}
                    <h3>Update your account</h3>
                  </div>
                  <span className="badge">Editable</span>
                </div>

                <div className="profile-form-grid">
                  <label>
                    Name
                    <input
                      value={profile.name}
                      onChange={(event) => setProfile((current) => ({ ...current, name: event.target.value }))}
                      autoComplete="name"
                    />
                  </label>
                  <label>
                    Email
                    <input
                      type="email"
                      value={profile.email}
                      onChange={(event) => setProfile((current) => ({ ...current, email: event.target.value }))}
                      autoComplete="email"
                    />
                  </label>
                  <label>
                    Current password
                    <input
                      type="password"
                      value={profile.currentPassword}
                      onChange={(event) => setProfile((current) => ({ ...current, currentPassword: event.target.value }))}
                      autoComplete="current-password"
                      placeholder="Required for email or password changes"
                    />
                  </label>
                  <label>
                    New password
                    <input
                      type="password"
                      value={profile.newPassword}
                      onChange={(event) => setProfile((current) => ({ ...current, newPassword: event.target.value }))}
                      autoComplete="new-password"
                      placeholder="Leave blank to keep current password"
                    />
                  </label>
                  <label>
                    Contact preference
                    <select
                      value={profile.contactPreference}
                      onChange={(event) => setProfile((current) => ({ ...current, contactPreference: event.target.value }))}
                    >
                      <option value="email">Email</option>
                      <option value="sms">SMS</option>
                      <option value="call">Phone call</option>
                    </select>
                  </label>
                  <label>
                    Interests
                    <input
                      value={profile.interests}
                      onChange={(event) => setProfile((current) => ({ ...current, interests: event.target.value }))}
                      placeholder="Community updates, events, volunteering"
                    />
                  </label>
                  <label>
                    Visibility
                    <select
                      value={profile.visibility}
                      onChange={(event) => setProfile((current) => ({ ...current, visibility: event.target.value }))}
                    >
                      <option value="public">Public</option>
                      <option value="members">Members only</option>
                      <option value="private">Private</option>
                    </select>
                  </label>
                </div>

                <button className="button primary full" type="submit" disabled={loadingProfile}>
                  {loadingProfile ? 'Saving...' : 'Save profile changes'}
                </button>
                {profileMessage ? <p className="message error">{profileMessage}</p> : null}
              </form>
            ) : null}

            {!isLoggedIn ? (
              <div className="notice-board">
                <h3>{auth.mode === 'register' ? 'Create your account' : 'Welcome back'}</h3>
                <p>
                  Use the form below to register or sign in, then you can support the village and keep your
                  account synced across sessions.
                </p>

                <div className="auth-switch">
                  <button
                    className="pill"
                    type="button"
                    onClick={() => {
                      setAuthMessage('');
                      setAuth((current) => ({
                        ...current,
                        mode: current.mode === 'register' ? 'login' : 'register',
                      }));
                    }}
                  >
                    Switch to {auth.mode === 'register' ? 'sign in' : 'register'}
                  </button>
                </div>

                <form className="form" onSubmit={submitAuth}>
                  {auth.mode === 'register' ? (
                    <label>
                      Name
                      <input
                        value={auth.name}
                        onChange={(event) => setAuth((current) => ({ ...current, name: event.target.value }))}
                        placeholder="Maya River"
                        autoComplete="name"
                        required
                      />
                    </label>
                  ) : null}
                  <label>
                    Email
                    <input
                      type="email"
                      value={auth.email}
                      onChange={(event) => setAuth((current) => ({ ...current, email: event.target.value }))}
                      placeholder="maya@example.com"
                      autoComplete="email"
                      required
                    />
                  </label>
                  <label>
                    Password
                    <input
                      type="password"
                      value={auth.password}
                      onChange={(event) => setAuth((current) => ({ ...current, password: event.target.value }))}
                      placeholder="At least 8 characters"
                      autoComplete={auth.mode === 'register' ? 'new-password' : 'current-password'}
                      required
                    />
                  </label>
                  <button className="button primary full" type="submit" disabled={loadingAuth}>
                    {loadingAuth ? 'Working...' : auth.mode === 'register' ? 'Create account' : 'Sign in'}
                  </button>
                  {authMessage ? <p className="message error">{authMessage}</p> : null}
                </form>
              </div>
            ) : (
              <div className="notice-board">
                <h3>Welcome back</h3>
                <p>
                  You are signed in. Use the dashboard, community, and admin sections to keep the village
                  running smoothly.
                </p>
                <div className="auth-switch">
                  <button className="pill danger" type="button" onClick={signOut}>
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </section>
        ) : null}

        {statusMessage ? <section className="card status-banner">{statusMessage}</section> : null}
        <div className="toasts" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={`toast ${t.kind || 'info'}`}>
              <span>{t.message}</span>
              <button type="button" className="toast-close" onClick={() => setToasts((items) => items.filter((item) => item.id !== t.id))}>
                ×
              </button>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}